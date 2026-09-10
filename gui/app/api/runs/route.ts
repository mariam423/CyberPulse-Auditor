/**
 * GET /api/runs — List all audit runs
 */
import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
