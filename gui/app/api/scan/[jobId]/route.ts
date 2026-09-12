/**
 * GET  /api/scan/[jobId] — Poll audit job status
 * GET  /api/scan/[jobId]?stream=1 — Server-Sent Events live progress
 * ──────────────────────────────────────────────────────────────────
 * Returns the job envelope: { jobId, status, progress, phase, result? }
 * `stream=1` upgrades to SSE — the queue emits transitions live, so
 * dashboards update without polling intervals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuditQueue } from '@shared/queue/audit-queue.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JOB_ID_RE = /^job_[a-f0-9-]{8,64}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    if (!JOB_ID_RE.test(jobId)) {
      return NextResponse.json({ error: 'Invalid job id format' }, { status: 400 });
    }

    const queue = getAuditQueue();

    // ── SSE live stream ─────────────────────────────────────────────
    if (new URL(req.url).searchParams.get('stream') === '1') {
      const job = await queue.status(jobId);
      if (!job) {
        return NextResponse.json({ error: `Job ${jobId} not found` }, { status: 404 });
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = (payload: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          };

          const onJob = (j: { id: string }) => {
            if (j.id === jobId) {
              const { payload: _p, ...safe } = j as Record<string, unknown> & { payload?: unknown };
              send(safe);
              const status = (j as { status?: string }).status;
              if (status === 'complete' || status === 'error' || status === 'cancelled') {
                cleanup();
                controller.close();
              }
            }
          };

          const cleanup = () => {
            queue.removeListener('job', onJob);
            clearInterval(keepalive);
          };

          // Current snapshot immediately, then live transitions.
          const { payload: _drop, ...snapshot } = job;
          void _drop;
          send(snapshot);

          queue.on('job', onJob);

          // Keepalive comment every 25s — proxies don't close idle SSE.
          const keepalive = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'));
            } catch {
              cleanup();
            }
          }, 25_000);

          // Hard stop after 10 minutes (client can reconnect).
          setTimeout(() => {
            cleanup();
            try { controller.close(); } catch { /* already closed */ }
          }, 10 * 60 * 1000).unref?.();
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no', // nginx: flush SSE chunks immediately
        },
      });
    }

    // ── Plain poll ───────────────────────────────────────────────────
    const job = await queue.status(jobId);
    if (!job) {
      return NextResponse.json({ error: `Job ${jobId} not found` }, { status: 404 });
    }

    // Never leak model config (may contain apiKey) to the response.
    const { payload: _payload, ...safe } = job;
    void _payload;
    return NextResponse.json(safe, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[api/scan/job] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
