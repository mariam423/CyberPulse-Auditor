/**
 * POST /api/scan — Start a new security audit scan
 * Body: StartScanRequest
 * Response: { runId, status, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { runAudit } from '@core/orchestrator';
import type { StartScanRequest } from '@core/types';
import { StartScanRequestSchema } from '@core/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolve the shared database path at the project root.
 * The Next.js server always runs with cwd = gui/, so the shared DB is
 * <project root>/data/cyberpulse.db → ../data/cyberpulse.db from here.
 * (import.meta.url is unreliable in bundled routes — webpack rewrites it.)
 */
function rootDbPath(): string {
  if (process.env.CYBERPULSE_DB_PATH) return resolve(process.env.CYBERPULSE_DB_PATH);
  return resolve(process.cwd(), '../data/cyberpulse.db');
}

export async function POST(req: NextRequest) {
  try {
    const body: StartScanRequest = StartScanRequestSchema.parse(await req.json());

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
      rootDbPath()
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
