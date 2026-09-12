/**
 * GET /api/queue — Queue + store health metrics (ops observability)
 * ───────────────────────────────────────────────────────────────────
 * Exposes the system-design vitals used for autoscaling + alerting:
 *   - queue depth (backlog pressure)
 *   - workers busy / total (throughput saturation)
 *   - storage driver kind + health (SQLite vs Postgres)
 *   - rate limiter backend (memory vs Redis)
 */
import { NextResponse } from 'next/server';
import { getAuditQueue } from '@shared/queue/audit-queue.js';
import { getStoreDriver } from '@shared/store/drivers.js';
import { withRateLimit } from '@/lib/api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(): Promise<NextResponse> {
  try {
    const queue = getAuditQueue();
    const store = getStoreDriver();

    const [queueStats, storeHealthy] = await Promise.all([
      queue.stats(),
      store.ping().catch(() => false),
    ]);

    return NextResponse.json(
      {
        queue: queueStats,
        storage: {
          driver: store.kind,
          healthy: storeHealthy,
        },
        limiter: {
          backend: process.env.REDIS_URL ? 'redis' : 'memory',
        },
        saturation: {
          queued: queueStats.queued,
          workersBusy: queueStats.busy,
          workersTotal: queueStats.workers,
          utilizationPct: Math.round((queueStats.busy / Math.max(1, queueStats.workers)) * 100),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[api/queue] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit('queue', handle);
