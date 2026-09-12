/**
 * POST /api/retest — Re-run validation against a specific finding.
 *
 * Mirrors `cyberpulse retest --run <id> --finding <id>` one-to-one:
 * same store lookups, same patched-prompt selection, same Validator
 * invocation, same retest persistence, same JSON result shape.
 *
 * Guardrails: rate-limited, Zod-validated body, safe error responses.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { z } from 'zod';
import { SqliteStore } from '@shared/store/sqlite.js';
import { createTargetAdapter } from '@shared/targets/adapter.js';
import { Validator, ValidatorInputSchema } from '@shared/agents/validator.js';
import { newRetestId, asRunId, asFindingId } from '@shared/util/ids.js';
import type { RunId, FindingId } from '@shared/util/ids.js';
import { withRateLimit, parseJsonBody, BodyValidationError } from '@/lib/api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RetestRequestSchema = z.object({
  runId: z.string().regex(/^run_[a-f0-9]+$/, 'Invalid run id'),
  findingId: z.string().min(1, 'findingId is required'),
});

export type RetestRequest = z.infer<typeof RetestRequestSchema>;

/** The shared DB lives at <project root>/data/cyberpulse.db — the Next server runs with cwd = gui/. */
function rootDbPath(): string | undefined {
  return process.env.CYBERPULSE_DB_PATH || resolve(process.cwd(), '../data/cyberpulse.db');
}

async function handleRetest(req: NextRequest): Promise<NextResponse> {
  let store: SqliteStore | null = null;
  try {
    // Guardrail: Zod-validated, size-capped JSON body
    const body = await parseJsonBody(req, RetestRequestSchema);
    store = new SqliteStore(rootDbPath());

    // Same lookup sequence as the CLI retest command
    const run = store.getRun(asRunId(body.runId));
    if (!run) {
      return NextResponse.json({ error: `Run ${body.runId} not found` }, { status: 404 });
    }

    const findings = store.getFindingsByRun(asRunId(body.runId));
    const finding = findings.find((f) => f.id === body.findingId);
    if (!finding) {
      return NextResponse.json(
        { error: `Finding ${body.findingId} not found in run ${body.runId}` },
        { status: 404 }
      );
    }

    const patches = store.getPatchesByFinding(asFindingId(body.findingId));

    let targetConfig: Record<string, unknown> = {};
    try { targetConfig = JSON.parse(run.target); } catch { /* ignore — same as CLI */ }

    const target = createTargetAdapter({
      type: targetConfig.type as 'http' | 'openai-compatible' | 'python-fn',
      url: targetConfig.url as string | undefined,
      pythonFn: targetConfig.pythonFn as string | undefined,
      headers: targetConfig.headers as Record<string, string> | undefined,
      timeout: 30_000,
    });

    const patch = patches.find((p) => p.kind === 'prompt');
    const patchedSystemPrompt = patch?.after_or_diff;

    // Same validator invocation as the CLI
    const validator = new Validator(target);
    const input = ValidatorInputSchema.parse({
      findingId: finding.id,
      owaspId: finding.owasp_id,
      blockedPayload: JSON.parse(finding.repro_json).payload,
      patchedSystemPrompt,
      runMutations: true,
    });

    const output = await validator.run(input);

    // Same persistence as the CLI
    store.addRetest({
      id: newRetestId(),
      runId: run.id as RunId,
      findingId: finding.id as FindingId,
      closed: output.closed,
      attempts: output.attempts,
      evidence: output.evidence,
    });

    // Same result shape as `cyberpulse retest --output json`
    return NextResponse.json({
      findingId: finding.id,
      owaspId: finding.owasp_id,
      verdict: output.verdict,
      closed: output.closed,
      attemptsCount: output.attempts.length,
      evidence: output.evidence,
      retestedWith: patchedSystemPrompt ? 'patched prompt' : 'original prompt',
    });
  } catch (err) {
    if (err instanceof BodyValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[api/retest] Error:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    store?.close();
  }
}

// Expensive mutating route: strict limiter (10 retests / minute / IP).
export const POST = withRateLimit('retest', handleRetest, { max: 10, windowMs: 60_000 });
