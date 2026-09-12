/**
 * Custom Rule Engine — YAML-defined security rules
 * ─────────────────────────────────────────────────
 * Types and Zod schemas for user-defined vulnerability checks.
 *
 * A custom rule is either:
 *  - a PAYLOAD rule: adds attack payloads to an OWASP category (used by the
 *    Attacker agent and classified by the OWASP Evaluator), or
 *  - a DETECTION rule: adds response indicators (success signals) that the
 *    Attacker uses to detect whether an attack succeeded.
 *
 * Rules are loaded from YAML files, validated with Zod, and merged into the
 * payload registry — extending (never replacing) the built-in OWASP payloads.
 */

import { z } from 'zod';
import type { OwaspId, Severity } from '../owasp/types.js';

/** Mutator names accepted in YAML rules (must match PayloadMutator). */
export const RULE_MUTATORS = [
  'none',
  'base64',
  'hex',
  'url-encode',
  'unicode-escape',
  'role-play',
  'framing',
  'multi-turn-chain',
  'context-injection',
] as const;

export const RuleMutatorSchema = z.enum(RULE_MUTATORS);
export type RuleMutator = z.infer<typeof RuleMutatorSchema>;

export const OwaspIdRuleSchema = z.enum([
  'LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05',
  'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10',
]);

/** Severity recognized by the evaluator and reporters. */
export const RuleSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

/**
 * A single payload entry inside a rule file.
 * Mirrors the shape of AttackPayload so it can be injected directly
 * into the Attacker's payload selection path.
 */
export const RulePayloadSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'payload id must be kebab-case (a-z, 0-9, -)'),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    template: z.string().min(1).max(4000),
    variables: z.record(z.string().min(1).max(500)).optional(),
    recommendedMutators: z.array(RuleMutatorSchema).max(5).optional(),
    multiTurn: z.boolean().optional(),
    threatLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  })
  .strict();
export type RulePayload = z.infer<typeof RulePayloadSchema>;

/**
 * A single indicator entry: a success signal for attack detection.
 */
export const RuleIndicatorSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'indicator id must be kebab-case (a-z, 0-9, -)'),
    pattern: z.string().min(2).max(500),
    caseSensitive: z.boolean().optional(),
  })
  .strict();
export type RuleIndicator = z.infer<typeof RuleIndicatorSchema>;

/** The top-level YAML rule-file schema. */
export const CustomRulesFileSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(120),
    description: z.string().max(1000).optional(),
    rules: z
      .array(
        z
          .object({
            owaspId: OwaspIdRuleSchema,
            severity: RuleSeveritySchema.optional(),
            payloads: z.array(RulePayloadSchema).max(50).default([]),
            indicators: z.array(RuleIndicatorSchema).max(100).default([]),
          })
          .strict()
      )
      .max(20)
      .default([]),
  })
  .strict();
export type CustomRulesFile = z.infer<typeof CustomRulesFileSchema>;

/** Parsed, engine-ready form of a rule file (post-processing output). */
export interface CompiledRule {
  owaspId: OwaspId;
  severity: Severity | null;
  payloads: RulePayload[];
  indicators: RuleIndicator[];
  /** Source file the rule came from (for audit trail). */
  sourceFile: string;
}

export interface RuleLoadStats {
  filesLoaded: number;
  rulesLoaded: number;
  payloadsAdded: number;
  indicatorsAdded: number;
}

/** Structured, safe error for rule-file validation failures. */
export class RuleValidationError extends Error {
  readonly filePath: string;
  readonly zodErrors: z.ZodError;

  constructor(filePath: string, zodErrors: z.ZodError) {
    const issues = zodErrors.errors
      .slice(0, 10)
      .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('; ');
    super(`Invalid rule file ${filePath}: ${issues}`);
    this.name = 'RuleValidationError';
    this.filePath = filePath;
    this.zodErrors = zodErrors;
  }
}

export type { OwaspId, Severity };
