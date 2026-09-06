/**
 * POST /api/scan — Start a new security audit scan
 * Body: StartScanRequest
 * Response: { runId, status, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { runAudit } from '../../../../../src/core/orchestrator.js';
import type { StartScanRequest } from '../../../../../src/core/types.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body: StartScanRequest = await req.json();

    const result = await runAudit(
      {
        goal: body.goal,
        target: {
          type: body.target.type,
          url: body.target.url,
          pythonFn: body.target.pythonFn,
          headers: body.target.headers,
          timeout: 30_000,
        },
        owaspIds: body.owaspIds ?? [
          'LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05',
          'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10',
        ],
        maxIterations: body.maxIterations,
        applyPatches: body.applyPatches,
        allowOpenCritical: body.allowOpenCritical,
      },
      body.model,
      'json',
      process.env.CYBERPULSE_DB_PATH ?? 'data/cyberpulse.db'
    );

    return NextResponse.json({
      runId: result.runId,
      status: result.status,
      findingsCount: result.findings.length,
      patchesCount: result.patches.length,
      iterations: result.iterations,
      findings: result.findings,
    }, { status: 200 });
  } catch (err) {
    console.error('[api/scan] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
