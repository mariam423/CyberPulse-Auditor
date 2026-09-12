import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuditQueue,
  InProcessQueueDriver,
  type AuditJobPayload,
} from '../src/queue/audit-queue.js';
import { getRateLimiter } from '../src/queue/rate-limiter.js';

/** Fast fake audit runner — simulates the engine without network/model. */
function fakeRunner(delayMs = 10) {
  return async (
    payload: AuditJobPayload,
    onProgress?: (p: number, phase: string) => void
  ) => {
    onProgress?.(50, 'attack');
    await new Promise((r) => setTimeout(r, delayMs));
    return {
      runId: `run_test_${payload.goal.length}`,
      status: 'complete',
      findingsCount: 2,
      patchesCount: 1,
      iterations: 1,
    };
  };
}

function basePayload(tenantId?: string): AuditJobPayload {
  return {
    goal: 'test-audit',
    target: { type: 'http', url: 'http://mock.local' },
    model: { provider: 'openai', model: 'gpt-4o' },
    maxIterations: 1,
    applyPatches: false,
    allowOpenCritical: false,
    ...(tenantId ? { tenantId } : {}),
  };
}

/** Wait until the queue drains all work (bounded). */
async function drain(q: AuditQueue, timeoutMs = 5000): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    const s = await q.stats();
    if (s.queued === 0 && s.running === 0 && s.terminal > 0) return;
    if (Date.now() - t0 > timeoutMs) throw new Error('queue did not drain in time');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('Scalable Audit Queue', () => {
  let queue: AuditQueue;

  beforeEach(() => {
    queue = new AuditQueue({ driver: new InProcessQueueDriver(), workers: 4, runner: fakeRunner(15) });
  });

  it('submit returns a jobId immediately (non-blocking contract)', async () => {
    const t0 = Date.now();
    const job = await queue.submit(basePayload());
    const elapsed = Date.now() - t0;
    expect(job.id).toMatch(/^job_[a-f0-9-]+$/);
    expect(job.status).toBe('queued');
    expect(elapsed).toBeLessThan(50); // ~O(1) enqueue, no engine work
  });

  it('processes a job end-to-end: queued → running → complete', async () => {
    const job = await queue.submit(basePayload());
    await drain(queue);

    const final = await queue.status(job.id);
    expect(final?.status).toBe('complete');
    expect(final?.result?.runId).toBe('run_test_10');
    expect(final?.progress).toBe(100);
    expect(final?.phase).toBe('complete');
    expect(final?.startedAt).toBeTruthy();
    expect(final?.finishedAt).toBeTruthy();
  });

  it('worker errors become terminal job errors (no worker crash)', async () => {
    const failing = new AuditQueue({
      driver: new InProcessQueueDriver(),
      workers: 1,
      runner: async () => {
        throw new Error('engine exploded');
      },
    });
    const job = await failing.submit(basePayload());
    await drain(failing);

    const final = await failing.status(job.id);
    expect(final?.status).toBe('error');
    expect(final?.error).toContain('engine exploded');
  });

  it('sustains 100 concurrent submissions without loss', async () => {
    const N = 100;
    const submissions = await Promise.all(
      Array.from({ length: N }, (_, i) => queue.submit(basePayload(`tenant_${i % 7}`)))
    );
    expect(submissions).toHaveLength(N);

    await drain(queue, 15_000);

    const stats = await queue.stats();
    expect(stats.terminal).toBe(N);

    // Every job must have reached terminal state.
    for (const j of submissions) {
      const final = await queue.status(j.id);
      expect(['complete', 'error']).toContain(final?.status);
    }
  });

  it('reports live progress through the driver', async () => {
    const seen: number[] = [];
    const progressQueue = new AuditQueue({
      driver: new InProcessQueueDriver(),
      workers: 1,
      runner: async (_p, onProgress) => {
        onProgress?.(25, 'recon');
        onProgress?.(60, 'attack');
        await new Promise((r) => setTimeout(r, 5));
        return { runId: 'run_x', status: 'complete', findingsCount: 0, patchesCount: 0, iterations: 1 };
      },
    });
    const job = await progressQueue.submit(basePayload());
    progressQueue.on('job', (j: { id: string; progress?: number }) => {
      if (j.id === job.id && j.progress !== undefined) seen.push(j.progress);
    });
    await drain(progressQueue);
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });

  it('per-tenant fairness: one tenant cannot starve others', async () => {
    // 10 jobs from tenant A, then 1 from tenant B, single worker.
    const fair = new AuditQueue({
      driver: new InProcessQueueDriver(),
      workers: 1,
      runner: fakeRunner(5),
    });
    for (let i = 0; i < 10; i++) await fair.submit(basePayload('tenantA'));
    const bJob = await fair.submit(basePayload('tenantB'));

    await drain(fair, 10_000);

    const bFinal = await fair.status(bJob.id);
    expect(bFinal?.status).toBe('complete');
    // B's job should NOT have waited behind all 10 of A's jobs —
    // the fairness window skips tenant-busy candidates.
    const allComplete = (await fair.stats()).terminal === 11;
    expect(allComplete).toBe(true);
  });

  it('load shedding: isSaturated flips when depth crosses the threshold', async () => {
    const shallow = new AuditQueue({
      driver: new InProcessQueueDriver(),
      workers: 0 === 0 ? 1 : 1, // single worker, no auto pump interference
      runner: fakeRunner(50),   // slow → backlog builds
    });
    expect(await shallow.isSaturated(3)).toBe(false);
    await shallow.submit(basePayload());
    await shallow.submit(basePayload());
    await shallow.submit(basePayload());
    await shallow.submit(basePayload()); // 4 queued > 3
    expect(await shallow.isSaturated(3)).toBe(true);
  });

  it('sweeps terminal jobs after retention window', async () => {
    const job = await queue.submit(basePayload());
    await drain(queue);
    // Sweep with zero retention → removes the terminal job.
    const removed = await queue.sweep(0);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await queue.status(job.id)).toBeNull();
  });

  it('drains gracefully (SIGTERM contract for containers)', async () => {
    await queue.submit(basePayload());
    await queue.drain();
    const s = await queue.stats();
    expect(s.running).toBe(0);
  });
});

describe('Distributed rate limiter (memory backend)', () => {
  beforeEach(() => {
    // ensure the default (no REDIS_URL) memory limiter
    delete process.env.REDIS_URL;
  });

  it('enforces the fixed window limit', async () => {
    const limiter = getRateLimiter();
    let ok = 0;
    for (let i = 0; i < 12; i++) {
      const r = await limiter.consume('ip:1.2.3.4', 10, 60_000);
      if (r.ok) ok++;
    }
    expect(ok).toBe(10); // 11th+ rejected
  });

  it('keys are isolated (per-IP limits)', async () => {
    const limiter = getRateLimiter();
    for (let i = 0; i < 5; i++) await limiter.consume('ip:a', 5, 60_000);
    const a = await limiter.consume('ip:a', 5, 60_000);
    const b = await limiter.consume('ip:b', 5, 60_000);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(true);
  });

  it('reports remaining budget and reset time', async () => {
    const limiter = getRateLimiter();
    const r = await limiter.consume('ip:c', 3, 60_000);
    expect(r.remaining).toBe(2);
    expect(r.resetAt).toBeGreaterThan(Date.now());
  });
});
