import type { PromptPatch } from './types.js';
import type { OwaspId } from '../owasp/types.js';
/**
 * Rule-based system prompt hardening templates per OWASP id.
 * Each rule describes what to add/remove/replace in the system prompt.
 */
interface HardeningRule {
    type: 'add' | 'remove' | 'replace';
    text?: string;
    insertTemplate?: string;
    condition?: (prompt: string) => boolean;
}
interface HardeningTemplate {
    owaspId: OwaspId;
    /** Rules to apply to the system prompt */
    rules: HardeningRule[];
    /** Explanation of why these rules help */
    rationale: string;
    /** A template for the new system prompt section (used as the 'add' text) */
    insertTemplate?: string;
}
/**
 * Apply hardening rules to a system prompt for a given OWASP id.
 */
export declare function hardenPrompt(owaspId: OwaspId, originalPrompt: string): PromptPatch;
/**
 * Get all hardening rules for a given OWASP id.
 */
export declare function getHardeningTemplate(owaspId: OwaspId): HardeningTemplate | undefined;
export {};
