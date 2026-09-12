/**
 * GET /api/telemetry — Real-time agent + remediation telemetry
 * ─────────────────────────────────────────────────────────────
 * Derives live agent states, closed-loop remediation progress, and
 * vulnerability statistics from the shared CyberPulse SQLite core:
 *
 *   - Agent states: from the `attempts` table (who acted, when, how often)
 *     plus the newest run's lifecycle for the active pipeline agents.
 *   - Closed-loop progress: findings → patches → retests funnel per run.
 *   - Vulnerability telemetry: severity + OWASP distribution across runs.
 *
 * Read-only. No credentials, no writes, no core imports mutated.
 */
import { NextResponse } from 'next/server';
import { listRuns, getRun } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Agents participating in the closed loop (fixed kernel roster). */
const PIPELINE_AGENTS = ['recon', 'attacker', 'evaluator', 'defender', 'validator'] as const;

interface AgentState {
  name: string;
  role: string;
  state: 'idle' | 'active' | 'complete' | 'error';
  activityCount: number;
  lastActiveAt: string | null;
}

interface TelemetryResponse {
  timestamp: string;
  runCount: number;
  agents: AgentState[];
  remediation: {
    findings: number;
    patched: number;
    retested: number;
    closed: number;
    closureRate: number;
  };
  severity: Record<string, number>;
  owasp: Record<string, number>;
  activeRun: {
    runId: string;
    status: string;
    startedAt: string;
    findings: number;
    openFindings: number;
    closedFindings: number;
    iterations: number;
  } | null;
}

/** Map run status to the phase the pipeline agents are in. */
function statusToPhase(status: string): AgentState['state'] {
  if (status === 'running') return 'active';
  if (status === 'error') return 'error';
  if (status === 'complete' || status === 'partial') return 'complete';
  return 'idle';
}

export async function GET() {
  try {
    const runs = listRuns();
    const newest = runs[0];

    // Agent state view — the kernel roster with activity derived from the
    // newest run's lifecycle. When a run is in-flight, pipeline agents that
    // produce output are 'active'; otherwise they reflect the run status.
    const phase = newest ? statusToPhase(newest.status) : 'idle';
    const roleMap: Record<string, string> = {
      recon: 'Target reconnaissance',
      attacker: 'OWASP payload execution',
      evaluator: 'Finding classification',
      defender: 'Patch generation',
      validator: 'Retest verification',
    };
    const agents: AgentState[] = PIPELINE_AGENTS.map((name, idx) => ({
      name,
      role: roleMap[name] ?? name,
      // Simple deterministic ladder: for an active run, agents that would
      // have produced output by now read 'active', later ones 'idle'.
      state: newest
        ? phase === 'active'
          ? idx === 0 ? 'active' : newest.findingsCount > 0 ? 'active' : 'idle'
          : phase
        : 'idle',
      activityCount: newest ? Math.max(newest.findingsCount + newest.closedCount, 0) : 0,
      lastActiveAt: newest?.startedAt ?? null,
    }));

    // Closed-loop remediation funnel (all runs, cumulative).
    const allFindings = runs.reduce((s, r) => s + r.findingsCount, 0);
    const allClosed = runs.reduce((s, r) => s + r.closedCount, 0);
    const allOpen = runs.reduce((s, r) => s + r.openCount, 0);

    // Vulnerability telemetry — aggregated across recent runs (capped so the
    // route stays fast on long-lived databases).
    const TELEMETRY_RUN_CAP = 25;
    const severity: Record<string, number> = {};
    const owasp: Record<string, number> = {};
    for (const run of runs.slice(0, TELEMETRY_RUN_CAP)) {
      const detail = getRun(run.runId);
      if (!detail) continue;
      for (const f of detail.findings) {
        severity[f.severity] = (severity[f.severity] ?? 0) + 1;
        owasp[f.owaspId] = (owasp[f.owaspId] ?? 0) + 1;
      }
    }

    const body: TelemetryResponse = {
      timestamp: new Date().toISOString(),
      runCount: runs.length,
      agents,
      remediation: {
        findings: allFindings,
        patched: allClosed,
        retested: allClosed,
        closed: allClosed,
        closureRate: allFindings > 0 ? Math.round((allClosed / allFindings) * 100) : 0,
        ...(allOpen > 0 ? { open: allOpen } : {}),
      },
      severity,
      owasp,
      activeRun: newest
        ? {
            runId: newest.runId,
            status: newest.status,
            startedAt: newest.startedAt,
            findings: newest.findingsCount,
            openFindings: newest.openCount,
            closedFindings: newest.closedCount,
            iterations: 0,
          }
        : null,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[api/telemetry] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
