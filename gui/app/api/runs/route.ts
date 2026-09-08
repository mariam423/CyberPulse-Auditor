/**
 * GET /api/runs — List all audit runs
 * GET /api/runs/[id] — Get a specific run
 */
import { NextRequest, NextResponse } from 'next/server';
import { listRuns, getRun } from '../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const id = parts[parts.length - 1];

  try {
    if (id && id !== 'runs') {
      const run = getRun(id);
      if (!run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }
      return NextResponse.json(run);
    }

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
