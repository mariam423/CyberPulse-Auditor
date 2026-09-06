/**
 * QwenPaw Adapter
 *
 * This module is the ONLY place that knows whether QwenPaw is:
 * (a) a real external package we import, OR
 * (b) a logical name for the in-repo multi-agent kernel we implement
 *
 * Architecture:
 *   Custom Orchestrator (outer loop) → QwenPawAdapter → QwenPaw kernel
 *
 * If QwenPaw is a real package: import it here, delegate to its API.
 * If QwenPaw is not yet available: implement the kernel interface in-repo,
 * and this adapter becomes the no-op identity.
 *
 * The Custom Orchestrator talks to this adapter via the contracts in §3.6 of ARCHITECTURE.md
 * (AttackInput, AttackOutput, Finding, Patch, RetestResult).
 */
import type { RunId } from '../util/ids.js';
export interface QwenPawAgentConfig {
    name: string;
    systemPrompt: string;
    tools: string[];
}
export interface QwenPawStepResult {
    step: string;
    output: unknown;
    durationMs: number;
    error?: string;
}
export interface QwenPawIterationResult {
    runId: RunId;
    iteration: number;
    steps: QwenPawStepResult[];
    findings: unknown[];
    patches: unknown[];
    status: 'success' | 'partial' | 'error';
}
/**
 * QwenPaw kernel interface.
 * This is the contract between the Custom Orchestrator and the QwenPaw kernel.
 */
export interface IQwenPawKernel {
    /**
     * Run one iteration of the closed-loop workflow.
     * The kernel drives: recon → attack → classify → remediate → retest.
     */
    runIteration(runId: RunId, iteration: number, input: unknown): Promise<QwenPawIterationResult>;
    /**
     * Register an agent with the kernel.
     */
    registerAgent(config: QwenPawAgentConfig): void;
    /**
     * Interrupt the current run (for human-in-the-loop approval).
     */
    interrupt(reason: string): void;
}
import type { ModelClient } from '../model/types.js';
import type { TargetAdapter } from '../targets/types.js';
/**
 * In-repo implementation of the QwenPaw kernel contract.
 * Implements the multi-agent workflow for a single iteration.
 *
 * Agents used:
 *   - Attacker: probes the target with OWASP payloads
 *   - OwaspEvaluator: maps attack transcripts to findings
 *   - Defender: generates remediation patches
 *   - Validator: retests patched target
 */
export declare class InRepoQwenPawKernel implements IQwenPawKernel {
    private readonly model;
    private readonly target;
    private readonly maxMutations;
    constructor(model: ModelClient, target: TargetAdapter, maxMutations?: number);
    runIteration(runId: RunId, iteration: number, input: unknown): Promise<QwenPawIterationResult>;
    registerAgent(_config: QwenPawAgentConfig): void;
    interrupt(_reason: string): void;
}
/**
 * Create the QwenPaw kernel.
 * Checks whether QwenPaw is available as a real package;
 * falls back to the in-repo implementation.
 *
 * TODO: When a real QwenPaw package is available, import it here and delegate.
 * For now, always returns the in-repo implementation.
 */
export declare function createQwenPawKernel(model: ModelClient, target: TargetAdapter, maxMutations?: number): IQwenPawKernel;
