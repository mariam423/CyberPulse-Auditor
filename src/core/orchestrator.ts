/**
 * CyberPulse Core — Audit Orchestrator
 *
 * Single-instance orchestrator backed by the existing Custom Orchestrator.
 * Exposes a clean promise-based API consumable by both CLI (direct import)
 * and GUI (via API routes).
 */

import type { AuditConfig, ScanStatus, RunReport, OwaspId } from './types.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { createModelClient } from '../model/provider.js';
import { createTargetAdapter } from '../targets/adapter.js';
import type { AuditOutputFormat } from '../orchestrator/orchestrator.js';

export type { AuditConfig, ScanStatus, RunReport, OwaspId };

/**
 * Build a ScanStatus snapshot from a running orchestrator.
 */
export function buildScanStatus(runId: string | null, phase: ScanStatus['phase'], progress: number, currentOwasp: OwaspId | null, iterations: number, findingsCount: number, patchesCount: number, startedAt: string | null): ScanStatus {
  return { runId, phase, progress, currentOwasp, iterations, findingsCount, patchesCount, startedAt };
}

/**
 * Create a new audit run from config + descriptors.
 * Returns the final RunReport.
 */
export async function runAudit(
  config: AuditConfig,
  modelDescriptor: { provider: 'openai' | 'anthropic' | 'ollama'; model: string; apiKey?: string; baseUrl?: string },
  outputFormat: AuditOutputFormat = 'json',
  dbPath?: string
): Promise<RunReport> {
  const target = createTargetAdapter({
    type: config.target.type,
    url: config.target.url,
    pythonFn: config.target.pythonFn,
    headers: config.target.headers,
    timeout: config.target.timeout ?? 30_000,
  });

  const model = createModelClient({
    provider: modelDescriptor.provider,
    model: modelDescriptor.model,
    apiKey: modelDescriptor.apiKey,
    baseUrl: modelDescriptor.baseUrl,
    timeout: 60_000,
    maxRetries: 3,
  });

  // Import and use the existing Orchestrator
  const { OrchestratorConfigSchema } = await import('../orchestrator/orchestrator.js');
  const { OrchestratorConfigSchema: OrigSchema } = await import('../orchestrator/orchestrator.js');

  const cfg = OrchestratorConfigSchema.parse({
    goal: config.goal,
    targetDescriptor: JSON.stringify(config.target),
    owaspIds: config.owaspIds,
    maxIterations: config.maxIterations,
    applyPatches: config.applyPatches,
    allowOpenCritical: config.allowOpenCritical,
    dbPath,
  });

  const orchestrator = new Orchestrator(cfg, model, target, dbPath);

  try {
    const result = await orchestrator.run(outputFormat);
    return {
      runId: result.runId,
      status: result.status,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      target: JSON.stringify(config.target),
      goal: config.goal,
      iterations: result.iterations,
      findings: result.findings as RunReport['findings'],
      patches: result.patches as RunReport['patches'],
      retests: result.retests as unknown as RunReport['retests'],
    };
  } finally {
    orchestrator.close();
  }
}

/**
 * List all runs from the SQLite store.
 */
export async function listRuns(dbPath?: string): Promise<Array<{
  runId: string; status: string; goal: string; target: string;
  startedAt: string; finishedAt: string | null;
  findingsCount: number; openCount: number; closedCount: number;
}>> {
  const { SqliteStore } = await import('../store/sqlite.js');
  const store = new SqliteStore(dbPath);
  try {
    const runs = store.listRuns();
    return runs.map((r) => {
      const findings = store.getFindingsByRun(r.id as any);
      return {
        runId: r.id,
        status: r.status,
        goal: JSON.parse(r.config_json).goal ?? '',
        target: r.target,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        findingsCount: findings.length,
        openCount: findings.filter((f) => !f.closed).length,
        closedCount: findings.filter((f) => f.closed).length,
      };
    });
  } finally {
    store.close();
  }
}

/**
 * Load a single run with full findings.
 */
export async function getRun(runId: string, dbPath?: string): Promise<RunReport | null> {
  const { SqliteStore } = await import('../store/sqlite.js');
  const store = new SqliteStore(dbPath);
  try {
    const run = store.getRun(runId as any);
    if (!run) return null;
    const findings = store.getFindingsByRun(runId as any);
    const config = JSON.parse(run.config_json);
    return {
      runId: run.id,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at ?? new Date().toISOString(),
      target: run.target,
      goal: config.goal ?? '',
      iterations: config.maxIterations ?? 1,
      findings: findings.map((f) => ({
        id: f.id,
        owaspId: f.owasp_id as OwaspId,
        severity: f.severity as any,
        title: f.title,
        evidence: f.evidence,
        repro: JSON.parse(f.repro_json),
        closed: f.closed === 1,
      })),
      patches: [],
      retests: [],
    };
  } finally {
    store.close();
  }
}
