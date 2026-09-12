/**
 * POST /api/scan — Enqueue an audit (async, non-blocking)
 * ─────────────────────────────────────────────────────────────
 * SCALE: returns a jobId in ~1ms instead of blocking the connection
 * for the full 30s+ audit. Workers process the queue at their own pace.
 *
 * Response 202: { jobId, status: "queued", queuePosition? }
 * Response 503: queue saturated (load shedding — try again shortly)
 */
import { NextRequest, NextResponse } from 'next/server';
import { StartScanRequestSchema } from '@core/types';
import type { StartScanRequest } from '@core/types';
import { withRateLimit, parseJsonBody, BodyValidationError } from '@/lib/api-guard';
import { getAuditQueue } from '@shared/queue/audit-queue.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleScan(req: NextRequest): Promise<NextResponse> {
  try {
    const body: StartScanRequest = await parseJsonBody(req, StartScanRequestSchema);

    const queue = getAuditQueue();

    // Load shedding: protect worker throughput under stampede.
    if (await queue.isSaturated(Number(process.env.QUEUE_MAX_DEPTH ?? 200))) {
      return NextResponse.json(
        { error: 'Scan queue is saturated — please retry in a moment.' },
        { status: 503, headers: { 'Retry-After': '30' } }
      );
    }

    const job = await queue.submit({
      goal: body.goal,
      target: {
        type: body.target.type,
        url: body.target.url,
        pythonFn: body.target.pythonFn,
        headers: body.target.headers,
      },
      model: body.model,
      owaspIds: body.owaspIds,
      maxIterations: body.maxIterations,
      applyPatches: body.applyPatches,
      allowOpenCritical: body.allowOpenCritical,
    });

    return NextResponse.json(
      { jobId: job.id, status: job.status, queuedAt: job.enqueuedAt },
      { status: 202, headers: { Location: `/api/scan/${job.id}` } }
    );
  } catch (err) {
    if (err instanceof BodyValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[api/scan] Enqueue error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Enqueue is cheap now (async workers do the heavy lifting), but still
// rate-limited per IP to protect queue depth from abusive clients.
export const POST = withRateLimit('scan', handleScan, { max: 30, windowMs: 60_000 });
