import { z } from 'zod';
import { Agent } from './base.js';
import type { ModelClient } from '../model/types.js';
import type { TargetAdapter } from '../targets/types.js';
export declare const AttackInputSchema: z.ZodObject<{
    plan: z.ZodObject<{
        owaspId: z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>;
        goal: z.ZodString;
        targetDescriptor: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        goal: string;
        targetDescriptor: string;
    }, {
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        goal: string;
        targetDescriptor: string;
    }>;
    useMutations: z.ZodOptional<z.ZodBoolean>;
    maxMutations: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    plan: {
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        goal: string;
        targetDescriptor: string;
    };
    useMutations?: boolean | undefined;
    maxMutations?: number | undefined;
}, {
    plan: {
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        goal: string;
        targetDescriptor: string;
    };
    useMutations?: boolean | undefined;
    maxMutations?: number | undefined;
}>;
export type AttackInput = z.infer<typeof AttackInputSchema>;
export declare const AttackOutputSchema: z.ZodObject<{
    owaspId: z.ZodString;
    goal: z.ZodString;
    results: z.ZodArray<z.ZodObject<{
        payloadId: z.ZodString;
        payload: z.ZodString;
        turns: z.ZodArray<z.ZodObject<{
            role: z.ZodString;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            role: string;
            content: string;
        }, {
            role: string;
            content: string;
        }>, "many">;
        rawResponse: z.ZodString;
        success: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        payloadId: string;
        payload: string;
        turns: {
            role: string;
            content: string;
        }[];
        rawResponse: string;
        success: boolean;
        error?: string | undefined;
    }, {
        payloadId: string;
        payload: string;
        turns: {
            role: string;
            content: string;
        }[];
        rawResponse: string;
        success: boolean;
        error?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    owaspId: string;
    goal: string;
    results: {
        payloadId: string;
        payload: string;
        turns: {
            role: string;
            content: string;
        }[];
        rawResponse: string;
        success: boolean;
        error?: string | undefined;
    }[];
}, {
    owaspId: string;
    goal: string;
    results: {
        payloadId: string;
        payload: string;
        turns: {
            role: string;
            content: string;
        }[];
        rawResponse: string;
        success: boolean;
        error?: string | undefined;
    }[];
}>;
export type AttackOutput = z.infer<typeof AttackOutputSchema>;
/**
 * Attacker agent — the offensive persona of the red-teaming engine.
 * Selects payloads for a given OWASP id, applies mutations,
 * executes multi-turn conversations against the target, and reports success.
 */
export declare class Attacker extends Agent<AttackInput, AttackOutput> {
    readonly inputSchema: z.ZodSchema<AttackInput>;
    readonly outputSchema: z.ZodType<AttackOutput>;
    private readonly model;
    private readonly target;
    constructor(model: ModelClient, target: TargetAdapter);
    protected invoke(input: AttackInput, _attempt: number): Promise<AttackOutput>;
    private runSinglePayload;
    private callTarget;
}
