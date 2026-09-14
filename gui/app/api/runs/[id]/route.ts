/**
 * GET /api/runs/[id] — Get a specific run with full findings
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/db';
import { RunIdParamSchema } from '@/lib/api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Strict id-format gate BEFORE any DB access — malformed ids get a
    // 400 instead of falling into the store / error surfaces.
    const parsedId = RunIdParamSchema.safeParse(params.id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid run id format' }, { status: 400 });
    }
    const run = getRun(parsedId.data);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch {
    // Never echo internal error details to API clients.
    console.error('[api/runs/:id] Error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
