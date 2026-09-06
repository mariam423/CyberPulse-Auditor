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
import type { RunId } from '../util/ids.js';
import type { ModelClient } from '../model/types.js';
import type { TargetAdapter } from '../targets/types.js';
import type { FindingReport, PatchReport, RetestReport } from '../report/types.js';
export declare const OrchestratorConfigSchema: z.ZodObject<{
    goal: z.ZodString;
    targetDescriptor: z.ZodString;
    owaspIds: z.ZodArray<z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>, "many">;
    maxIterations: z.ZodDefault<z.ZodNumber>;
    applyPatches: z.ZodDefault<z.ZodBoolean>;
    allowOpenCritical: z.ZodDefault<z.ZodBoolean>;
    dbPath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    goal: string;
    targetDescriptor: string;
    owaspIds: ("LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10")[];
    maxIterations: number;
    applyPatches: boolean;
    allowOpenCritical: boolean;
    dbPath?: string | undefined;
}, {
    goal: string;
    targetDescriptor: string;
    owaspIds: ("LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10")[];
    maxIterations?: number | undefined;
    applyPatches?: boolean | undefined;
    allowOpenCritical?: boolean | undefined;
    dbPath?: string | undefined;
}>;
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;
export declare const AuditOutputFormat: z.ZodEnum<["json", "markdown", "sarif", "text", "html"]>;
export type AuditOutputFormat = z.infer<typeof AuditOutputFormat>;
export interface AuditResult {
    runId: RunId;
    status: 'complete' | 'partial' | 'error';
    findings: FindingReport[];
    patches: PatchReport[];
    retests: RetestReport[];
    iterations: number;
    output: string;
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
export declare class Orchestrator {
    private readonly config;
    private readonly model;
    private readonly target;
    private readonly store;
    private readonly kernel;
    private readonly runId;
    private readonly startedAt;
    constructor(config: OrchestratorConfig, model: ModelClient, target: TargetAdapter, dbPath?: string);
    /**
     * Execute the full closed-loop audit.
     * Returns the final report in the requested format.
     */
    run(format?: AuditOutputFormat): Promise<AuditResult>;
    private formatReport;
    close(): void;
}
