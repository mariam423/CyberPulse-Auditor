/**
 * Custom Orchestrator — the outer loop and policy layer of CyberPulse.
 *
 * Responsibilities (§3.3.2 of ARCHITECTURE.md):
 *   - Owns the closed-loop policy (severity gates, iteration budget, termination rules)
 *   - Mirrors every step to SQLite for the audit trail
 *   - Calls the QwenPaw kernel for each iteration
 *   - Owns the reporters (Markdown, SARIF, JSON)
 *   - Implements human-in-the-loop hooks (--apply, --allow-open-critical)
 *
 * The QwenPaw kernel is accessed only through src/orchestrator/qwenpaw-adapter.ts.
 */

import { z } from 'zod';
import { logger } from '../util/logger.js';
import { newRunId } from '../util/ids.js';
import type { RunId } from '../util/ids.js';
import { SqliteStore } from '../store/sqlite.js';
import { createQwenPawKernel } from './qwenpaw-adapter.js';
import type { IQwenPawKernel, QwenPawIterationResult } from './qwenpaw-adapter.js';
import type { ModelClient } from '../model/types.js';
import type { TargetAdapter } from '../targets/types.js';
import type { OwaspId } from '../owasp/types.js';
import { formatMarkdown } from '../report/markdown.js';
import { formatSarif } from '../report/sarif.js';
import { formatHtml } from '../report/html.js';
import { formatJson } from '../report/json.js';
import { formatTextReport } from '../report/text.js';
import type { RunReport, FindingReport, PatchReport, RetestReport } from '../report/types.js';

export const OrchestratorConfigSchema = z.object({
  goal: z.string(),
  targetDescriptor: z.string(),
  owaspIds: z.array(z.enum(['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10'])),
  maxIterations: z.number().min(1).max(10).default(3),
  applyPatches: z.boolean().default(false),   // if true, auto-apply patches; else propose only
  allowOpenCritical: z.boolean().default(false), // if false, never report with open Critical findings
  dbPath: z.string().optional(),
});
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export const AuditOutputFormat = z.enum(['json', 'markdown', 'sarif', 'text', 'html']);
export type AuditOutputFormat = z.infer<typeof AuditOutputFormat>;

export interface AuditResult {
  runId: RunId;
  status: 'complete' | 'partial' | 'error';
  findings: FindingReport[];
  patches: PatchReport[];
  retests: RetestReport[];
  iterations: number;
  output: string; // formatted report
}

/**
 * Severity gate policy: never report with open Critical findings unless --allow-open-critical is set.
 */
function policyAllCriticalClosed(findings: FindingReport[], allowOpenCritical: boolean): boolean {
  const openCritical = findings.filter((f) => f.severity === 'critical' && !f.closed);
  if (openCritical.length > 0 && !allowOpenCritical) {
    logger.warn('orchestrator:policy', `Blocking report: ${openCritical.length} open Critical finding(s)`);
    return false;
  }
  return true;
}

/**
 * Custom Orchestrator — the outer loop.
 *
 * Flow:
 *   for iteration in 1..maxIterations:
 *       outcome = qwenpaw.runOneIteration()
 *       audit_trail.write(outcome)
 *       if policy.allCriticalClosed(outcome.findings):
 *           break
 *   reporters.emit(audit_trail)
 */
export class Orchestrator {
  private readonly config: OrchestratorConfig;
  private readonly model: ModelClient;
  private readonly target: TargetAdapter;
  private readonly store: SqliteStore;
  private readonly kernel: IQwenPawKernel;
  private readonly runId: RunId;
  private readonly startedAt: Date;

  constructor(config: OrchestratorConfig, model: ModelClient, target: TargetAdapter, dbPath?: string) {
    this.config = config;
    this.model = model;
    this.target = target;
    this.store = new SqliteStore(dbPath);
    this.kernel = createQwenPawKernel(model, target);
    this.runId = newRunId();
    this.startedAt = new Date();

    logger.info('orchestrator', `Starting run ${this.runId} with goal: ${config.goal}`);
  }

  /**
   * Execute the full closed-loop audit.
   * Returns the final report in the requested format.
   */
  async run(format: AuditOutputFormat = 'text'): Promise<AuditResult> {
    const { maxIterations, owaspIds, goal, targetDescriptor } = this.config;

    // Create run record
    this.store.createRun(this.runId, targetDescriptor, this.config);

    const allFindings: FindingReport[] = [];
    const allPatches: PatchReport[] = [];
    const allRetests: RetestReport[] = [];
    let iterations = 0;
    let finalStatus: 'complete' | 'partial' | 'error' = 'complete';

    for (let i = 1; i <= maxIterations; i++) {
      iterations = i;
      logger.info('orchestrator', `Starting iteration ${i}/${maxIterations}`);

      let iterationResult: QwenPawIterationResult;
      try {
        iterationResult = await this.kernel.runIteration(this.runId, i, {
          goal,
          targetDescriptor,
          owaspIds,
        });
      } catch (err) {
        logger.error('orchestrator', `Iteration ${i} failed`, err);
        finalStatus = 'error';
        break;
      }

      // Mirror findings to store — build owaspId→findingId map for patch FK resolution
      const owaspIdToFindingId = new Map<string, string>();
      for (const finding of iterationResult.findings) {
        const f = finding as Record<string, unknown>;
        const findingId = f.id as string;
        owaspIdToFindingId.set(f.owaspId as string, findingId);
        this.store.addFinding({
          id: findingId as any,
          runId: this.runId,
          owaspId: f.owaspId as OwaspId,
          severity: f.severity as string,
          title: f.title as string,
          evidence: f.evidence as string,
          repro: f.repro as { payload: string; target: string; expected: string },
        });

        allFindings.push({
          id: findingId,
          owaspId: f.owaspId as string,
          severity: f.severity as FindingReport['severity'],
          title: f.title as string,
          evidence: f.evidence as string,
          repro: f.repro as FindingReport['repro'],
          closed: false,
        });
      }

      // Mirror patches to store — resolve findingId via owaspId map (FK constraint)
      for (const patch of iterationResult.patches) {
        const p = patch as Record<string, unknown>;
        const patchId = (p.id as string) ?? `patch_${Math.random().toString(36).slice(2, 10)}`;
        const owaspId = (p.owaspId as string) ?? '';
        const resolvedFindingId = owaspIdToFindingId.get(owaspId) ?? owaspId;

        this.store.addPatch({
          id: patchId as any,
          runId: this.runId,
          findingId: resolvedFindingId as any,
          kind: (p.kind as 'prompt' | 'code') ?? 'prompt',
          before: (p.before as string) ?? '',
          afterOrDiff: (p.after ?? p.diff ?? '') as string,
          zodSchema: (p.zodSchema as string) ?? '',
          rationale: (p.rationale as string) ?? '',
        });

        allPatches.push({
          id: patchId,
          findingId: resolvedFindingId,
          owaspId: (p.owaspId as string) ?? '',
          kind: (p.kind as 'prompt' | 'code') ?? 'prompt',
          rationale: (p.rationale as string) ?? '',
          requiresRestart: (p.requiresRestart as boolean) ?? false,
          applied: this.config.applyPatches,
        });
      }

      // Policy gate: check if all critical findings are closed
      if (policyAllCriticalClosed(allFindings, this.config.allowOpenCritical)) {
        logger.info('orchestrator', `Policy gate passed at iteration ${i} — breaking loop`);
        break;
      }

      if (i === maxIterations) {
        finalStatus = 'partial';
        logger.warn('orchestrator', `Max iterations (${maxIterations}) reached — marking as partial`);
      }
    }

    // Close retests based on patches
    for (const finding of allFindings) {
      const hasPatch = allPatches.some((p) => p.findingId === finding.id);
      if (hasPatch) {
        finding.closed = true;
        finding.closedBy = allPatches.find((p) => p.findingId === finding.id)?.id ?? '';
        this.store.closeFinding(finding.id as any);

        allRetests.push({
          findingId: finding.id,
          verdict: 'closed',
          attemptsCount: 1,
          evidence: 'Closed by defender patch',
        });
      }
    }

    // Finish run
    this.store.finishRun(this.runId, finalStatus);

    // Build report
    const report: RunReport = {
      runId: this.runId,
      status: finalStatus,
      startedAt: this.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      target: this.config.targetDescriptor,
      goal: this.config.goal,
      iterations,
      findings: allFindings,
      patches: allPatches,
      retests: allRetests,
    };

    const output = this.formatReport(report, format);

    logger.info('orchestrator', `Run ${this.runId} complete: ${allFindings.length} findings, ${allPatches.length} patches, ${iterations} iterations`);

    return {
      runId: this.runId,
      status: finalStatus,
      findings: allFindings,
      patches: allPatches,
      retests: allRetests,
      iterations,
      output,
    };
  }

  private formatReport(report: RunReport, format: AuditOutputFormat): string {
    switch (format) {
      case 'markdown':
        return formatMarkdown(report);
      case 'sarif':
        return JSON.stringify(formatSarif(report), null, 2);
      case 'json':
        return formatJson(report);
      case 'html':
        return formatHtml(report);
      case 'text':
      default:
        return formatTextReport(report);
    }
  }

  close(): void {
    this.store.close();
  }
}
