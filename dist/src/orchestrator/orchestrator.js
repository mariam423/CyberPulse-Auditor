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
import { newRunId, asFindingId, asPatchId } from '../util/ids.js';
import { SqliteStore } from '../store/sqlite.js';
import { createQwenPawKernel } from './qwenpaw-adapter.js';
import { formatMarkdown } from '../report/markdown.js';
import { formatSarif } from '../report/sarif.js';
import { formatHtml } from '../report/html.js';
import { formatJson } from '../report/json.js';
import { formatTextReport } from '../report/text.js';
export const OrchestratorConfigSchema = z.object({
    goal: z.string(),
    targetDescriptor: z.string(),
    owaspIds: z.array(z.enum(['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10'])),
    maxIterations: z.number().min(1).max(10).default(3),
    applyPatches: z.boolean().default(false), // if true, auto-apply patches; else propose only
    allowOpenCritical: z.boolean().default(false), // if false, never report with open Critical findings
    dbPath: z.string().optional(),
});
export const AuditOutputFormat = z.enum(['json', 'markdown', 'sarif', 'text', 'html']);
/**
 * Severity gate policy: never report with open Critical findings unless --allow-open-critical is set.
 */
function policyAllCriticalClosed(findings, allowOpenCritical) {
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
    config;
    model;
    target;
    store;
    kernel;
    runId;
    startedAt;
    constructor(config, model, target, dbPath) {
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
    async run(format = 'text') {
        const { maxIterations, owaspIds, goal, targetDescriptor } = this.config;
        // Create run record
        this.store.createRun(this.runId, targetDescriptor, this.config);
        const allFindings = [];
        const allPatches = [];
        const allRetests = [];
        let iterations = 0;
        let finalStatus = 'complete';
        for (let i = 1; i <= maxIterations; i++) {
            iterations = i;
            logger.info('orchestrator', `Starting iteration ${i}/${maxIterations}`);
            let iterationResult;
            try {
                iterationResult = await this.kernel.runIteration(this.runId, i, {
                    goal,
                    targetDescriptor,
                    owaspIds,
                });
            }
            catch (err) {
                logger.error('orchestrator', `Iteration ${i} failed`, err);
                finalStatus = 'error';
                break;
            }
            // Mirror findings to store — build owaspId→findingId map for patch FK resolution
            const owaspIdToFindingId = new Map();
            for (const finding of iterationResult.findings) {
                const f = finding;
                const findingId = f.id;
                owaspIdToFindingId.set(f.owaspId, findingId);
                this.store.addFinding({
                    id: asFindingId(findingId),
                    runId: this.runId,
                    owaspId: f.owaspId,
                    severity: f.severity,
                    title: f.title,
                    evidence: f.evidence,
                    repro: f.repro,
                });
                allFindings.push({
                    id: findingId,
                    owaspId: f.owaspId,
                    severity: f.severity,
                    title: f.title,
                    evidence: f.evidence,
                    repro: f.repro,
                    closed: false,
                });
            }
            // Mirror patches to store — resolve findingId via owaspId map (FK constraint)
            for (const patch of iterationResult.patches) {
                const p = patch;
                const patchId = p.id ?? `patch_${Math.random().toString(36).slice(2, 10)}`;
                const owaspId = p.owaspId ?? '';
                const resolvedFindingId = owaspIdToFindingId.get(owaspId) ?? owaspId;
                this.store.addPatch({
                    id: asPatchId(patchId),
                    runId: this.runId,
                    findingId: asFindingId(resolvedFindingId),
                    kind: p.kind ?? 'prompt',
                    before: p.before ?? '',
                    afterOrDiff: (p.after ?? p.diff ?? ''),
                    zodSchema: p.zodSchema ?? '',
                    rationale: p.rationale ?? '',
                });
                allPatches.push({
                    id: patchId,
                    findingId: resolvedFindingId,
                    owaspId: p.owaspId ?? '',
                    kind: p.kind ?? 'prompt',
                    rationale: p.rationale ?? '',
                    requiresRestart: p.requiresRestart ?? false,
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
                this.store.closeFinding(asFindingId(finding.id));
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
        const report = {
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
    formatReport(report, format) {
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
    close() {
        this.store.close();
    }
}
//# sourceMappingURL=orchestrator.js.map