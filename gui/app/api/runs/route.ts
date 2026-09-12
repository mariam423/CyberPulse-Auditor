/**
 * GET /api/runs — List all audit runs
 * Guardrails: rate-limited, no-store cache policy.
 */
import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/db';
import { withRateLimit } from '@/lib/api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(): Promise<NextResponse> {
  try {
    const runs = listRuns();
    return NextResponse.json({ runs });
  } catch (err) {
    console.error('[api/runs] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit('runs', handle);
