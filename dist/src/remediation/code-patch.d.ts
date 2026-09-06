import { ZodError } from 'zod';
import type { CodePatch } from './types.js';
/**
 * Generates a code-level patch with a Zod validation schema.
 *
 * Strategy:
 * 1. Accept the original attack payload as a "blocked" input.
 * 2. Generate a Zod schema that rejects inputs matching the attack pattern.
 * 3. Produce a unified diff showing the minimal code change needed.
 *
 * The generated Zod schema should be such that:
 *   - parse(originalPayload) throws ZodError  (attack is blocked)
 *   - parse(sanitizedPayload) returns normally (legitimate use passes)
 */
export interface CodePatchOptions {
    owaspId: string;
    file: string;
    /** The original attack payload that should be rejected */
    attackPayload: string;
    /** A representative example of the expected legitimate input */
    legitimateExample: string;
    /** Suggested diff lines (old and new) */
    diffLines?: {
        old: string[];
        new: string[];
    };
    rationale: string;
}
/**
 * Build a Zod schema that blocks the given attack payload.
 * Uses keyword detection + pattern matching to create a rejection rule.
 */
export declare function buildBlockingSchema(attackPayload: string, _legitimateExample: string): string;
/**
 * Generate a minimal unified diff for a code change.
 */
export declare function generateDiff(file: string, oldLines: string[], newLines: string[]): string;
/**
 * Create a CodePatch for a given vulnerability.
 * Generates both the diff and the blocking Zod schema.
 */
export declare function createCodePatch(opts: CodePatchOptions): CodePatch;
/**
 * Validate that a given Zod schema actually blocks the attack payload.
 * Returns an error if the schema passes the attack payload (i.e., it's not actually blocking).
 */
export declare function validateBlockingSchema(schemaSource: string, attackPayload: string): ZodError | null;
