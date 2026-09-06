import { z } from 'zod';
import type { OwaspId } from '../owasp/types.js';

/** Patch kinds */
export const PatchKind = z.enum(['prompt', 'code']);
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

export const Patch = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('prompt'), owaspId: z.string(), before: z.string(), after: z.string(), rationale: z.string(), changes: z.array(z.object({ type: z.enum(['add', 'remove', 'replace']), text: z.string() })) }),
  z.object({ kind: z.literal('code'), owaspId: z.string(), file: z.string(), diff: z.string(), zodSchema: z.string(), rationale: z.string(), requiresRestart: z.boolean() }),
]);
export type Patch = z.infer<typeof Patch>;

export interface RemediationPlan {
  patches: Patch[];
  /** Which findings are addressed by this plan */
  addressedFindings: string[];
  /** Which findings remain unaddressed */
  unaddressedFindings: string[];
  summary: string;
}
