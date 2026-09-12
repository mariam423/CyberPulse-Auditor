/**
 * GET /api/runs/[id]/sarif — Download a run's findings as a SARIF 2.1.0 report.
 *
 * Consumes the unified report service (same as CLI `report --format sarif`),
 * so the SARIF payload is byte-identical between GUI and CLI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { getRun } from '@/lib/db';
import { buildRunReport, renderReport, reportFilename, FORMAT_META } from '@report/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The shared DB lives at <project root>/data/cyberpulse.db — the Next server runs with cwd = gui/. */
function rootDbPath(): string | undefined {
  return process.env.CYBERPULSE_DB_PATH || resolve(process.cwd(), '../data/cyberpulse.db');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const run = getRun(params.id);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Unified service: findings + patches + retests (identical to CLI)
    const report = buildRunReport(params.id, rootDbPath());
    if (!report) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const sarif = renderReport(report, 'sarif');

    return new NextResponse(sarif, {
      status: 200,
      headers: {
        'Content-Type': FORMAT_META.sarif.contentType,
        'Content-Disposition': `attachment; filename="${reportFilename(params.id, 'sarif')}"`,
      },
    });
  } catch (err) {
    console.error('[api/runs/:id/sarif] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
