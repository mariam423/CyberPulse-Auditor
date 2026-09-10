/**
 * GET /api/runs/[id]/sarif — Download a run's findings as a SARIF 2.1.0 report.
 *
 * Reads the shared CyberPulse database, rebuilds the RunReport shape, and
 * reuses the core SARIF formatter for 100% parity with CLI output.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/db';
import { formatSarif } from '@report/sarif';
import type { RunReport } from '@report/types';
import type { RunId } from '@shared/util/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const run = getRun(params.id);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Rebuild the RunReport shape the SARIF formatter expects
    const report: RunReport = {
      runId: run.runId as RunId,
      status: run.status as RunReport['status'],
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      target: run.target,
      goal: run.goal,
      iterations: run.iterations,
      findings: run.findings.map((f) => ({
        id: f.id,
        owaspId: f.owaspId,
        severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        title: f.title,
        evidence: f.evidence,
        repro: f.repro as { payload: string; target: string; expected: string },
        closed: f.closed,
      })),
      patches: [],
      retests: [],
    };

    const sarif = JSON.stringify(formatSarif(report), null, 2);
    const filename = `cyberpulse-${run.runId}.sarif`;

    return new NextResponse(sarif, {
      status: 200,
      headers: {
        'Content-Type': 'application/sarif+json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
