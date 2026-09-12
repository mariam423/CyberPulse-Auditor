import { z } from 'zod';
import { Agent } from './base.js';
/** Input: a list of findings to remediate */
export declare const DefenderInputSchema: z.ZodObject<{
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        owaspId: z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>;
        severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
        title: z.ZodString;
        evidence: z.ZodString;
        repro: z.ZodObject<{
            payload: z.ZodString;
            target: z.ZodString;
            expected: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            expected: string;
            payload: string;
            target: string;
        }, {
            expected: string;
            payload: string;
            target: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        severity: "medium" | "info" | "critical" | "high" | "low";
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        evidence: string;
        repro: {
            expected: string;
            payload: string;
            target: string;
        };
    }, {
        id: string;
        title: string;
        severity: "medium" | "info" | "critical" | "high" | "low";
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        evidence: string;
        repro: {
            expected: string;
            payload: string;
            target: string;
        };
    }>, "many">;
    /** Optional system prompt to harden (for prompt-level patches) */
    systemPrompt: z.ZodOptional<z.ZodString>;
    /** Optional source code context for code-level patches */
    sourceCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    findings: {
        id: string;
        title: string;
        severity: "medium" | "info" | "critical" | "high" | "low";
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        evidence: string;
        repro: {
            expected: string;
            payload: string;
            target: string;
        };
    }[];
    systemPrompt?: string | undefined;
    sourceCode?: string | undefined;
}, {
    findings: {
        id: string;
        title: string;
        severity: "medium" | "info" | "critical" | "high" | "low";
        owaspId: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
        evidence: string;
        repro: {
            expected: string;
            payload: string;
            target: string;
        };
    }[];
    systemPrompt?: string | undefined;
    sourceCode?: string | undefined;
}>;
export type DefenderInput = z.infer<typeof DefenderInputSchema>;
export declare const DefenderOutputSchema: z.ZodObject<{
    plan: z.ZodObject<{
        patches: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["prompt", "code"]>;
            owaspId: z.ZodString;
            before: z.ZodOptional<z.ZodString>;
            after: z.ZodOptional<z.ZodString>;
            rationale: z.ZodOptional<z.ZodString>;
            changes: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["add", "remove", "replace"]>;
                text: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "replace" | "add" | "remove";
                text: string;
            }, {
                type: "replace" | "add" | "remove";
                text: string;
            }>, "many">>;
            file: z.ZodOptional<z.ZodString>;
            diff: z.ZodOptional<z.ZodString>;
            zodSchema: z.ZodOptional<z.ZodString>;
            requiresRestart: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            owaspId: string;
            kind: "code" | "prompt";
            before?: string | undefined;
            after?: string | undefined;
            rationale?: string | undefined;
            changes?: {
                type: "replace" | "add" | "remove";
                text: string;
            }[] | undefined;
            file?: string | undefined;
            diff?: string | undefined;
            zodSchema?: string | undefined;
            requiresRestart?: boolean | undefined;
        }, {
            owaspId: string;
            kind: "code" | "prompt";
            before?: string | undefined;
            after?: string | undefined;
            rationale?: string | undefined;
            changes?: {
                type: "replace" | "add" | "remove";
                text: string;
            }[] | undefined;
            file?: string | undefined;
            diff?: string | undefined;
            zodSchema?: string | undefined;
            requiresRestart?: boolean | undefined;
        }>, "many">;
        addressedFindings: z.ZodArray<z.ZodString, "many">;
        unaddressedFindings: z.ZodArray<z.ZodString, "many">;
        summary: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        patches: {
            owaspId: string;
            kind: "code" | "prompt";
            before?: string | undefined;
            after?: string | undefined;
            rationale?: string | undefined;
            changes?: {
                type: "replace" | "add" | "remove";
                text: string;
            }[] | undefined;
            file?: string | undefined;
            diff?: string | undefined;
            zodSchema?: string | undefined;
            requiresRestart?: boolean | undefined;
        }[];
        addressedFindings: string[];
        unaddressedFindings: string[];
        summary: string;
    }, {
        patches: {
            owaspId: string;
            kind: "code" | "prompt";
            before?: string | undefined;
            after?: string | undefined;
            rationale?: string | undefined;
            changes?: {
                type: "replace" | "add" | "remove";
                text: string;
            }[] | undefined;
            file?: string | undefined;
            diff?: string | undefined;
            zodSchema?: string | undefined;
            requiresRestart?: boolean | undefined;
        }[];
        addressedFindings: string[];
        unaddressedFindings: string[];
        summary: string;
    }>;
    /** Whether each patch's Zod schema was validated against the attack payload */
    validationResults: z.ZodRecord<z.ZodString, z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    plan: {
        patches: {
            owaspId: string;
            kind: "code" | "prompt";
            before?: string | undefined;
            after?: string | undefined;
            rationale?: string | undefined;
            changes?: {
                type: "replace" | "add" | "remove";
                text: string;
            }[] | undefined;
            file?: string | undefined;
            diff?: string | undefined;
            zodSchema?: string | undefined;
            requiresRestart?: boolean | undefined;
        }[];
        addressedFindings: string[];
        unaddressedFindings: string[];
        summary: string;
    };
    validationResults: Record<string, boolean>;
}, {
    plan: {
        patches: {
            owaspId: string;
            kind: "code" | "prompt";
            before?: string | undefined;
            after?: string | undefined;
            rationale?: string | undefined;
            changes?: {
                type: "replace" | "add" | "remove";
                text: string;
            }[] | undefined;
            file?: string | undefined;
            diff?: string | undefined;
            zodSchema?: string | undefined;
            requiresRestart?: boolean | undefined;
        }[];
        addressedFindings: string[];
        unaddressedFindings: string[];
        summary: string;
    };
    validationResults: Record<string, boolean>;
}>;
export type DefenderOutput = z.infer<typeof DefenderOutputSchema>;
/**
 * Defender agent — the defensive persona.
 * Consumes Findings, produces a RemediationPlan with PromptPatch and/or CodePatch entries.
 *
 * Strategy per finding:
 * 1. Always produce a PromptPatch (hardening rules per OWASP id).
 * 2. For critical/high severity with a code-related attack, also produce a CodePatch.
 */
export declare class Defender extends Agent<DefenderInput, DefenderOutput> {
    readonly inputSchema: z.ZodType<DefenderInput>;
    readonly outputSchema: z.ZodType<DefenderOutput>;
    constructor();
    protected invoke(input: DefenderInput, _attempt: number): Promise<DefenderOutput>;
}
