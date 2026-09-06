import { z } from 'zod';
import { Agent } from './base.js';
import type { TargetAdapter } from '../targets/types.js';
export declare const ValidatorInputSchema: z.ZodObject<{
    /** Finding to retest */
    findingId: z.ZodString;
    owaspId: z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>;
    /** Original attack payload that was blocked */
    blockedPayload: z.ZodString;
    /** System prompt or code after applying the defender's patch */
    patchedSystemPrompt: z.ZodOptional<z.ZodString>;
    /** Whether to also run mutations of the original payload */
    runMutations: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
    findingId: string;
    blockedPayload: string;
    patchedSystemPrompt?: string | undefined;
    runMutations?: boolean | undefined;
}, {
    owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
    findingId: string;
    blockedPayload: string;
    patchedSystemPrompt?: string | undefined;
    runMutations?: boolean | undefined;
}>;
export type ValidatorInput = z.infer<typeof ValidatorInputSchema>;
export declare const RetestAttemptSchema: z.ZodObject<{
    payload: z.ZodString;
    response: z.ZodString;
    passed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    payload: string;
    response: string;
    passed: boolean;
}, {
    payload: string;
    response: string;
    passed: boolean;
}>;
export declare const ValidatorOutputSchema: z.ZodObject<{
    findingId: z.ZodString;
    closed: z.ZodBoolean;
    attempts: z.ZodArray<z.ZodObject<{
        payload: z.ZodString;
        response: z.ZodString;
        passed: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        payload: string;
        response: string;
        passed: boolean;
    }, {
        payload: string;
        response: string;
        passed: boolean;
    }>, "many">;
    evidence: z.ZodString;
    /** Summary of what happened */
    verdict: z.ZodEnum<["closed", "open", "inconclusive"]>;
}, "strip", z.ZodTypeAny, {
    evidence: string;
    findingId: string;
    closed: boolean;
    attempts: {
        payload: string;
        response: string;
        passed: boolean;
    }[];
    verdict: "closed" | "open" | "inconclusive";
}, {
    evidence: string;
    findingId: string;
    closed: boolean;
    attempts: {
        payload: string;
        response: string;
        passed: boolean;
    }[];
    verdict: "closed" | "open" | "inconclusive";
}>;
export type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;
/**
 * Validator agent — the auditor persona.
 * Re-runs the original (and optionally mutated) attack payloads against the
 * patched target. Uses majority vote across multiple runs for non-deterministic targets.
 */
export declare class Validator extends Agent<ValidatorInput, ValidatorOutput> {
    readonly inputSchema: z.ZodType<ValidatorInput>;
    readonly outputSchema: z.ZodType<ValidatorOutput>;
    private readonly target;
    private readonly maxRunsPerPayload;
    constructor(target: TargetAdapter);
    protected invoke(input: ValidatorInput, _attempt: number): Promise<ValidatorOutput>;
    private buildPayloads;
    private runPayloadMultiple;
    /**
     * Heuristic: attack is blocked if the response is a refusal or empty.
     * In a real scenario, this would be more sophisticated.
     */
    private isAttackBlocked;
    private buildEvidence;
}
