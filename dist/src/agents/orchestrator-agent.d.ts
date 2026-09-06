import { z } from 'zod';
import { Agent } from './base.js';
/**
 * Orchestrator Agent — QwenPaw kernel agent.
 * Responsible for coordinating the steps within a single iteration:
 *   recon → attack → classify → remediate → retest
 *
 * It reads the run config and target descriptor, routes work to Attacker/Defender/Validator,
 * and writes intermediate results to the shared blackboard.
 */
export declare const OrchestratorInputSchema: z.ZodObject<{
    runId: z.ZodString;
    goal: z.ZodString;
    targetDescriptor: z.ZodString;
    /** OWASP ids to probe in this iteration */
    owaspIds: z.ZodArray<z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>, "many">;
    /** Target adapter id for routing */
    targetId: z.ZodString;
    /** Iteration number (for audit trail) */
    iteration: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    goal: string;
    targetDescriptor: string;
    runId: string;
    owaspIds: ("LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10")[];
    targetId: string;
    iteration: number;
}, {
    goal: string;
    targetDescriptor: string;
    runId: string;
    owaspIds: ("LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10")[];
    targetId: string;
    iteration: number;
}>;
export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;
export declare const OrchestratorOutputSchema: z.ZodObject<{
    runId: z.ZodString;
    iteration: z.ZodNumber;
    /** Summary of what this iteration accomplished */
    summary: z.ZodString;
    /** Number of findings discovered */
    findingsCount: z.ZodNumber;
    /** Number of patches generated */
    patchesCount: z.ZodNumber;
    /** Whether the iteration completed successfully */
    status: z.ZodEnum<["success", "partial", "error"]>;
}, "strip", z.ZodTypeAny, {
    status: "partial" | "error" | "success";
    summary: string;
    runId: string;
    iteration: number;
    findingsCount: number;
    patchesCount: number;
}, {
    status: "partial" | "error" | "success";
    summary: string;
    runId: string;
    iteration: number;
    findingsCount: number;
    patchesCount: number;
}>;
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
/**
 * Orchestrator Agent — the neutral coordinator inside the QwenPaw kernel.
 *
 * In a full QwenPaw integration, this agent would:
 * 1. Call the Attacker for each OWASP id
 * 2. Call the OWASP Evaluator to produce findings
 * 3. Call the Defender to produce patches
 * 4. Call the Validator for retests
 * 5. Write all results to the shared blackboard
 *
 * For Phase 4, this agent serves as the "workflow driver" — it sequences
 * the agents and manages the blackboard state.
 */
export declare class OrchestratorAgent extends Agent<OrchestratorInput, OrchestratorOutput> {
    readonly inputSchema: z.ZodType<OrchestratorInput>;
    readonly outputSchema: z.ZodType<OrchestratorOutput>;
    constructor();
    protected invoke(input: OrchestratorInput, _attempt: number): Promise<OrchestratorOutput>;
}
