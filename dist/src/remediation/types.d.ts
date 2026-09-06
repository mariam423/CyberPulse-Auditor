import { z } from 'zod';
import type { OwaspId } from '../owasp/types.js';
/** Patch kinds */
export declare const PatchKind: z.ZodEnum<["prompt", "code"]>;
export type PatchKind = z.infer<typeof PatchKind>;
/** A prompt-level hardening patch (modifies the system prompt) */
export interface PromptPatch {
    kind: 'prompt';
    /** The OWASP vulnerability this patch addresses */
    owaspId: OwaspId;
    /** Current system prompt text */
    before: string;
    /** Hardened system prompt text */
    after: string;
    /** Why this change makes the system more secure */
    rationale: string;
    /** Specific rules added/removed/changed */
    changes: Array<{
        type: 'add' | 'remove' | 'replace';
        text: string;
    }>;
}
/** A code-level patch (unified diff + Zod validation schema) */
export interface CodePatch {
    kind: 'code';
    owaspId: OwaspId;
    /** Absolute or relative file path */
    file: string;
    /** Unified diff string */
    diff: string;
    /**
     * Zod schema source that validates inputs should be rejected.
     * The schema must parse() with a ZodError against the original attack payload.
     * After applying the patch, the same payload should pass validation.
     */
    zodSchema: string;
    /** Why this change makes the system more secure */
    rationale: string;
    /** Whether the patch requires a restart / redeploy to take effect */
    requiresRestart: boolean;
}
export declare const Patch: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"prompt">;
    owaspId: z.ZodString;
    before: z.ZodString;
    after: z.ZodString;
    rationale: z.ZodString;
    changes: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["add", "remove", "replace"]>;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "replace" | "add" | "remove";
        text: string;
    }, {
        type: "replace" | "add" | "remove";
        text: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    owaspId: string;
    kind: "prompt";
    before: string;
    after: string;
    rationale: string;
    changes: {
        type: "replace" | "add" | "remove";
        text: string;
    }[];
}, {
    owaspId: string;
    kind: "prompt";
    before: string;
    after: string;
    rationale: string;
    changes: {
        type: "replace" | "add" | "remove";
        text: string;
    }[];
}>, z.ZodObject<{
    kind: z.ZodLiteral<"code">;
    owaspId: z.ZodString;
    file: z.ZodString;
    diff: z.ZodString;
    zodSchema: z.ZodString;
    rationale: z.ZodString;
    requiresRestart: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    owaspId: string;
    kind: "code";
    rationale: string;
    file: string;
    diff: string;
    zodSchema: string;
    requiresRestart: boolean;
}, {
    owaspId: string;
    kind: "code";
    rationale: string;
    file: string;
    diff: string;
    zodSchema: string;
    requiresRestart: boolean;
}>]>;
export type Patch = z.infer<typeof Patch>;
export interface RemediationPlan {
    patches: Patch[];
    /** Which findings are addressed by this plan */
    addressedFindings: string[];
    /** Which findings remain unaddressed */
    unaddressedFindings: string[];
    summary: string;
}
