/**
 * GET /api/runs — List all audit runs
 * GET /api/runs/[id] — Get a specific run
 */
import { NextRequest, NextResponse } from 'next/server';
import { listRuns, getRun } from '../../../../../src/core/orchestrator.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const id = parts[parts.length - 1];

  try {
    if (id && id !== 'runs') {
      // Single run
      const run = await getRun(id, process.env.CYBERPULSE_DB_PATH ?? 'data/cyberpulse.db');
      if (!run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }
      return NextResponse.json(run);
    }

    // List all runs
    const runs = await listRuns(process.env.CYBERPULSE_DB_PATH ?? 'data/cyberpulse.db');
    return NextResponse.json({ runs });
  } catch (err) {
    console.error('[api/runs] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
