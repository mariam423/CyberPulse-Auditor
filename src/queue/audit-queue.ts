/**
 * Scalable Job Queue — async audit processing for millions of users
 * ─────────────────────────────────────────────────────────────────
 * ARCHITECTURE (system-design principles):
 *
 *   Client ──POST /api/scan──▶ API Server (stateless, N replicas)
 *                                   │
 *                                   ▼ enqueue (O(1), non-blocking)
 *                              ┌─ Job Queue ────────────────────────┐
 *                               (in-process today; Redis/BullMQ-
 *                                compatible interface for horizontal
 *                                scale-out — swap `QueueDriver`)
 *                                   │
 *                                   ▼ dequeue (concurrency-limited)
 *                              Worker Pool (audit engine)
 *                                   │
 *                                   ▼ writes
 *                              Shared Store (SQLite → Postgres driver)
 *
 * WHY: today `runAudit` runs inside the HTTP request — a 30s audit
 * blocks a web slot for 30s; 1M users would exhaust every connection.
 * With the queue: POST returns a jobId in ~1ms; workers process audits
 * at their own pace; clients poll/SSE for progress.
 *
 * ISOLATION: zero changes to the core audit engine (src/orchestrator/**)
 * — the worker calls the same `runAudit` the CLI uses.
 */

import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'      // accepted, waiting for a worker
  | 'running'     // worker processing
  | 'complete'    // success — result ready
  | 'error'       // failed — error message set
  | 'cancelled';  // removed before/during execution

export interface AuditJobPayload {
  goal: string;
  target: {
    type: 'http' | 'openai-compatible' | 'python-fn';
    url?: string;
    pythonFn?: string;
    headers?: Record<string, string>;
  };
  model: {
    provider: 'openai' | 'anthropic' | 'ollama';
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  owaspIds?: string[];
  maxIterations: number;
  applyPatches: boolean;
  allowOpenCritical: boolean;
  /** Requesting user/tenant — used for per-tenant fair scheduling. */
  tenantId?: string;
}

export interface AuditJob {
  id: string;
  status: JobStatus;
  payload: AuditJobPayload;
  /** Set when status=complete. */
  result?: {
    runId: string;
    status: string;
    findingsCount: number;
    patchesCount: number;
    iterations: number;
  };
  /** Set when status=error. */
  error?: string;
  progress: number;              // 0–100
  phase: string;                 // current pipeline phase label
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  attempts: number;              // retries so far
}

// ── Queue driver interface (Redis/BullMQ-swappable) ─────────────────────────

/**
 * The pluggable backend contract. The default InProcessDriver keeps
 * everything in this server process (perfect for the single-container
 * Docker deployment). For a multi-replica fleet, implement this against
 * Redis/BullMQ — the queue, worker, and API layers need zero changes.
 */
export interface QueueDriver {
  /** Atomically add a job. Returns its id. */
  enqueue(job: AuditJob): Promise<void>;
  /** Atomically claim the next runnable job (FIFO, per-tenant fair). */
  dequeue(): Promise<AuditJob | null>;
  /** Persist a job's current state. */
  update(job: AuditJob): Promise<void>;
  /** Fetch a job by id. */
  get(id: string): Promise<AuditJob | null>;
  /** Remove terminal jobs older than `ms`. */
  sweep(olderThanMs: number): Promise<number>;
  /** Queue depth snapshot (metrics). */
  stats(): Promise<{ queued: number; running: number; terminal: number }>;
}

/** In-memory driver — the default for single-container deployments. */
export class InProcessQueueDriver implements QueueDriver {
  private readonly jobs = new Map<string, AuditJob>();
  private readonly ready: AuditJob[] = []; // FIFO ring

  async enqueue(job: AuditJob): Promise<void> {
    this.jobs.set(job.id, job);
    this.ready.push(job);
  }

  async dequeue(): Promise<AuditJob | null> {
    // Per-tenant fairness: scan the head of the queue; skip jobs from
    // tenants that already have a running job so one whale tenant can't
    // starve everyone else. (Bounded scan window = fairness vs latency.)
    const FAIRNESS_WINDOW = 50;
    const limit = Math.min(this.ready.length, FAIRNESS_WINDOW);
    let chosenIdx = -1;

    const runningTenants = new Set<string>();
    for (const j of this.jobs.values()) {
      if (j.status === 'running' && j.payload.tenantId) {
        runningTenants.add(j.payload.tenantId);
      }
    }

    for (let i = 0; i < limit; i++) {
      const candidate = this.ready[i]!;
      const tenant = candidate.payload.tenantId;
      if (!tenant || !runningTenants.has(tenant)) {
        chosenIdx = i;
        break;
      }
    }
    // Fallback: head of queue even if tenant-busy (prevents starvation
    // when >50 jobs all belong to busy tenants).
    if (chosenIdx === -1 && this.ready.length > 0) chosenIdx = 0;
    if (chosenIdx === -1) return null;

    const [job] = this.ready.splice(chosenIdx, 1);
    return job ?? null;
  }

  async update(job: AuditJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async get(id: string): Promise<AuditJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async sweep(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;
    for (const [id, job] of this.jobs) {
      const terminal = job.status === 'complete' || job.status === 'error' || job.status === 'cancelled';
      const end = job.finishedAt ? Date.parse(job.finishedAt) : 0;
      if (terminal && end > 0 && end < cutoff) {
        this.jobs.delete(id);
        removed++;
      }
    }
    return removed;
  }

  async stats(): Promise<{ queued: number; running: number; terminal: number }> {
    let queued = 0;
    let running = 0;
    let terminal = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'queued') queued++;
      else if (job.status === 'running') running++;
      else terminal++;
    }
    return { queued, running, terminal };
  }
}

// ── The queue façade (API surface used by routes) ───────────────────────────

export class AuditQueue extends EventEmitter {
  private readonly driver: QueueDriver;
  private readonly workers: number;
  private busy = 0;
  private active = true;
  private sweeping = false;

  /** The audit runner — injected so tests can stub the engine. */
  private readonly runner: (payload: AuditJobPayload, onProgress?: (p: number, phase: string) => void) => Promise<AuditJob['result']>;

  constructor(opts: {
    driver?: QueueDriver;
    /** Worker concurrency — defaults to CPU cores (audit is I/O-heavy). */
    workers?: number;
    runner: AuditQueue['runner'];
  }) {
    super();
    this.driver = opts.driver ?? new InProcessQueueDriver();
    this.workers = opts.workers ?? Math.max(2, Math.min(8, availableParallelism()));
    this.runner = opts.runner;
    // The queue emits every state transition — SSE/polling layers subscribe.
    this.setMaxListeners(200); // one SSE stream per active dashboard
  }

  /** Enqueue an audit. Returns the accepted job (id immediately usable). */
  async submit(payload: AuditJobPayload): Promise<AuditJob> {
    const job: AuditJob = {
      id: `job_${randomUUID().replace(/-/g, '')}`,
      status: 'queued',
      payload,
      progress: 0,
      phase: 'queued',
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    await this.driver.enqueue(job);
    this.emit('job', job);
    this.pump(); // maybe a worker is idle
    return job;
  }

  /** Current state of a job (for GET /api/scan/[jobId]). */
  async status(id: string): Promise<AuditJob | null> {
    return this.driver.get(id);
  }

  /** Queue metrics (for the ops dashboard + load shedding). */
  async stats(): Promise<{ queued: number; running: number; terminal: number; workers: number; busy: number }> {
    const s = await this.driver.stats();
    return { ...s, workers: this.workers, busy: this.busy };
  }

  /** Load-shedding check: reject submissions when the queue is saturated. */
  async isSaturated(maxQueueDepth = 200): Promise<boolean> {
    const s = await this.driver.stats();
    return s.queued >= maxQueueDepth;
  }

  /** Cancel a queued job (running jobs cannot be stopped mid-flight). */
  async cancel(id: string): Promise<AuditJob | null> {
    const job = await this.driver.get(id);
    if (!job) return null;
    if (job.status !== 'queued') return job; // only queued jobs are cancellable
    const cancelled: AuditJob = { ...job, status: 'cancelled', finishedAt: new Date().toISOString() };
    await this.driver.update(cancelled);
    this.emit('job', cancelled);
    return cancelled;
  }

  /** Internal: pull work while workers are free. */
  private pump(): void {
    if (!this.active) return;
    while (this.busy < this.workers) {
      this.busy++; // reserve the slot SYNCHRONOUSLY (prevents pump storms)
      void this.runOne();
    }
  }

  /**
   * Run one job. The worker slot is reserved by pump() before entry and
   * released in the finally block. When the queue is empty, pump() is
   * re-armed ONLY on successful completions (a failed dequeue just
   * releases the slot) — this prevents an infinite pump↔dequeue-null
   * microtask churn when idle.
   */
  private async runOne(): Promise<void> {
    let gotJob = false;
    try {
      const job = await this.driver.dequeue();
      if (!job) return; // queue empty — slot released below, no re-pump

      gotJob = true;
      const started: AuditJob = {
        ...job,
        status: 'running',
        phase: 'initializing',
        startedAt: new Date().toISOString(),
        attempts: job.attempts + 1,
      };
      await this.driver.update(started);
      this.emit('job', started);

      const t0 = Date.now();
      try {
        const result = await this.runner(started.payload, (progress, phase) => {
          // Progress callback — persist throttled updates + emit live.
          void this.driver.update({ ...started, progress, phase });
          this.emit('job', { ...started, progress, phase });
        });

        const done: AuditJob = {
          ...started,
          status: 'complete',
          phase: 'complete',
          progress: 100,
          ...(result !== undefined ? { result } : {}),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
        };
        await this.driver.update(done);
        this.emit('job', done);
      } catch (err) {
        const failed: AuditJob = {
          ...started,
          status: 'error',
          phase: 'error',
          error: err instanceof Error ? err.message : String(err),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
        };
        await this.driver.update(failed);
        this.emit('job', failed);
      }
    } finally {
      this.busy--;
      // Chain ONLY when this worker actually processed a job. An empty
      // dequeue must not re-pump (see runOne docblock) — submit() always
      // pumps on new arrivals, so no work is ever missed.
      if (gotJob) this.pump();
    }
  }

  /** Periodic cleanup of terminal jobs (call on an interval). */
  async sweep(olderThanMs = 60 * 60 * 1000): Promise<number> {
    if (this.sweeping) return 0;
    this.sweeping = true;
    try {
      return await this.driver.sweep(olderThanMs);
    } finally {
      this.sweeping = false;
    }
  }

  /** Graceful drain (for SIGTERM in containers). */
  async drain(): Promise<void> {
    this.active = false;
    // Wait for in-flight jobs to finish (bounded by caller's patience).
    while (this.busy > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

function availableParallelism(): number {
  try {
    return os.availableParallelism?.() ?? os.cpus().length;
  } catch {
    return 4;
  }
}

// ── Singleton accessor (per-process) ────────────────────────────────────────

let instance: AuditQueue | null = null;

/**
 * The process-wide audit queue. Lazily constructed on first use with the
 * REAL audit engine. Routes import this — no per-request state.
 */
export function getAuditQueue(): AuditQueue {
  if (!instance) {
    instance = new AuditQueue({
      runner: async (payload, onProgress) => {
        // Bridge into the existing core engine — zero core changes.
        // Imported dynamically so the queue module stays testable.
        const { runAudit } = await import('../core/orchestrator.js');
        const phases = ['recon', 'attack', 'classify', 'remediate', 'retest'];
        let step = 0;
        const heartbeat = setInterval(() => {
          onProgress?.(Math.min(95, 10 + step * 18), phases[step] ?? 'running');
          step = (step + 1) % phases.length;
        }, 4_000);
        try {
          const result = await runAudit(
            {
              goal: payload.goal,
              target: {
                type: payload.target.type,
                ...(payload.target.url !== undefined ? { url: payload.target.url } : {}),
                ...(payload.target.pythonFn !== undefined ? { pythonFn: payload.target.pythonFn } : {}),
                ...(payload.target.headers !== undefined ? { headers: payload.target.headers } : {}),
                timeout: 30_000,
              },
              owaspIds: (payload.owaspIds ?? undefined) as never,
              maxIterations: payload.maxIterations,
              applyPatches: payload.applyPatches,
              allowOpenCritical: payload.allowOpenCritical,
            },
            payload.model,
            'json',
            process.env.CYBERPULSE_DB_PATH || resolveRootDb()
          );
          return {
            runId: result.runId,
            status: result.status,
            findingsCount: result.findings.length,
            patchesCount: result.patches.length,
            iterations: result.iterations,
          };
        } finally {
          clearInterval(heartbeat);
        }
      },
    });

    // Housekeeping: sweep terminal jobs hourly.
    setInterval(() => {
      void instance?.sweep();
    }, 60 * 60 * 1000).unref?.();
  }
  return instance;
}

function resolveRootDb(): string {
  // Next server runs with cwd=gui/ → shared DB at ../data/cyberpulse.db
  return resolve(process.cwd(), '..', 'data', 'cyberpulse.db');
}
