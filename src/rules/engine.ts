/**
 * Custom Rule Engine — YAML loader + compiler
 * ────────────────────────────────────────────
 * Ingests user-defined security rules from YAML files, validates them with
 * Zod, compiles them into engine-ready form, and registers them in an
 * isolated in-memory registry that extends (never replaces) the built-in
 * OWASP payload set.
 *
 * Integration contract:
 *  - Attacker calls `getActivePayloads(owaspId)` → built-in + custom payloads.
 *  - Attacker calls `getActiveIndicators(owaspId)` → custom success signals
 *    merged into the category-specific detection heuristics.
 *
 * ISOLATION: rule files are read from disk and validated BEFORE any value
 * reaches the engine; malformed files are rejected with a structured error
 * and never partially applied (all-or-nothing per file).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { logger } from '../util/logger.js';
import {
  CustomRulesFileSchema,
  RuleValidationError,
  type CompiledRule,
  type CustomRulesFile,
  type RuleIndicator,
  type RulePayload,
  type RuleLoadStats,
  type RuleMutator,
  type OwaspId,
  type Severity,
} from './types.js';

const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

/** In-memory registry of compiled custom rules (per-process, isolated). */
class CustomRuleRegistry {
  private readonly byOwaspId = new Map<OwaspId, CompiledRule[]>();
  private readonly loadedFiles = new Set<string>();
  private stats: RuleLoadStats = { filesLoaded: 0, rulesLoaded: 0, payloadsAdded: 0, indicatorsAdded: 0 };

  register(compiled: CompiledRule): void {
    const list = this.byOwaspId.get(compiled.owaspId) ?? [];
    list.push(compiled);
    this.byOwaspId.set(compiled.owaspId, list);
    this.stats.rulesLoaded++;
    this.stats.payloadsAdded += compiled.payloads.length;
    this.stats.indicatorsAdded += compiled.indicators.length;
  }

  noteFile(path: string): void {
    this.loadedFiles.add(path);
    this.stats.filesLoaded++;
  }

  payloadsFor(owaspId: OwaspId): CompiledRule[] {
    return this.byOwaspId.get(owaspId) ?? [];
  }

  indicatorList(owaspId: OwaspId): RuleIndicator[] {
    return this.payloadsFor(owaspId).flatMap((r) => r.indicators);
  }

  severityFor(owaspId: OwaspId): Severity | null {
    // First registered severity for a category wins (deterministic order).
    for (const rule of this.payloadsFor(owaspId)) {
      if (rule.severity) return rule.severity;
    }
    return null;
  }

  allRules(): CompiledRule[] {
    return Array.from(this.byOwaspId.values()).flat();
  }

  getStats(): RuleLoadStats & { files: string[] } {
    return { ...this.stats, files: Array.from(this.loadedFiles) };
  }

  /** Test helper — wipe the registry between test runs. */
  reset(): void {
    this.byOwaspId.clear();
    this.loadedFiles.clear();
    this.stats = { filesLoaded: 0, rulesLoaded: 0, payloadsAdded: 0, indicatorsAdded: 0 };
  }
}

/** Process-wide singleton registry (lazy, isolated from the core store). */
const registry = new CustomRuleRegistry();
export { registry };

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse a YAML string into a validated CustomRulesFile.
 * Throws RuleValidationError on schema violations, YAML syntax errors,
 * or non-object documents (e.g. plain scalars / arrays).
 */
export function parseRulesYaml(source: string, filePath = '<inline>'): CustomRulesFile {
  let raw: unknown;
  try {
    raw = yaml.load(source, {
      // Safety: rule files are data, never templates — no function types allowed.
      schema: yaml.DEFAULT_SCHEMA,
      json: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new RuleValidationError(filePath, buildZodError([`YAML syntax error: ${msg}`]));
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RuleValidationError(filePath, buildZodError(['document must be a YAML mapping']));
  }

  const parsed = CustomRulesFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RuleValidationError(filePath, parsed.error);
  }
  return parsed.data;
}

function buildZodError(messages: string[]): z.ZodError {
  return new z.ZodError(messages.map((message) => ({ code: 'custom', message, path: [] })));
}

// ── Loading ──────────────────────────────────────────────────────────────────

/** Load and register a single rule file. All-or-nothing per file. */
export function loadRulesFile(filePath: string): CustomRulesFile {
  const abs = resolve(filePath);
  if (!existsSync(abs)) {
    throw new RuleValidationError(abs, buildZodError(['file not found']));
  }
  if (!YAML_EXTENSIONS.has(extname(abs).toLowerCase())) {
    throw new RuleValidationError(abs, buildZodError(['file must have .yaml or .yml extension']));
  }

  let source: string;
  try {
    source = readFileSync(abs, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new RuleValidationError(abs, buildZodError([`unreadable file: ${msg}`]));
  }

  const file = parseRulesYaml(source, abs);

  // Reject duplicate rule categories inside a single file (ambiguity guard).
  const seen = new Set<string>();
  for (const rule of file.rules) {
    if (seen.has(rule.owaspId)) {
      throw new RuleValidationError(abs, buildZodError([`duplicate owaspId section: ${rule.owaspId}`]));
    }
    seen.add(rule.owaspId);
  }

  for (const rule of file.rules) {
    registry.register({
      owaspId: rule.owaspId,
      severity: rule.severity ?? null,
      payloads: rule.payloads,
      indicators: rule.indicators,
      sourceFile: abs,
    });
  }
  registry.noteFile(abs);
  logger.info('rules:engine', `Loaded ${file.rules.length} rule(s) from ${abs} (${file.name})`);
  return file;
}

/**
 * Load every .yaml/.yml file inside a directory (non-recursive) as rule files.
 * Directory-level atomicity: ALL files are parsed and validated FIRST; only
 * when every file passes are the rules registered. A single invalid file
 * aborts the whole load with zero side effects — strict by design so CI
 * never silently drops user rules.
 */
export function loadRulesDir(dirPath: string): RuleLoadStats {
  const abs = resolve(dirPath);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new RuleValidationError(abs, buildZodError(['directory not found']));
  }
  const files = readdirSync(abs)
    .filter((f) => YAML_EXTENSIONS.has(extname(f).toLowerCase()))
    .filter((f) => statSync(resolve(abs, f)).isFile())
    .sort();

  // Phase 1 — validate everything (throws before any registration happens).
  const parsedFiles = files.map((f) => {
    const fileAbs = resolve(abs, f);
    const parsed = parseRulesYaml(readFileSync(fileAbs, 'utf-8'), fileAbs);
    const seen = new Set<string>();
    for (const rule of parsed.rules) {
      if (seen.has(rule.owaspId)) {
        throw new RuleValidationError(fileAbs, buildZodError([`duplicate owaspId section: ${rule.owaspId}`]));
      }
      seen.add(rule.owaspId);
    }
    return { fileAbs, parsed };
  });

  // Phase 2 — register (guaranteed valid).
  for (const { fileAbs, parsed } of parsedFiles) {
    for (const rule of parsed.rules) {
      registry.register({
        owaspId: rule.owaspId,
        severity: rule.severity ?? null,
        payloads: rule.payloads,
        indicators: rule.indicators,
        sourceFile: fileAbs,
      });
    }
    registry.noteFile(fileAbs);
    logger.info('rules:engine', `Loaded ${parsed.rules.length} rule(s) from ${fileAbs} (${parsed.name})`);
  }
  return registry.getStats();
}

// ── Engine-facing API ─────────────────────────────────────────────────────────

/**
 * Get custom payloads registered for an OWASP category,
 * converted to the Attacker's AttackPayload shape.
 */
export function getCustomPayloads(owaspId: OwaspId): Array<{
  id: string;
  owaspId: OwaspId;
  name: string;
  description: string;
  template: string;
  variables?: Record<string, string>;
  recommendedMutators: RuleMutator[];
  multiTurn: boolean;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  custom: true;
}> {
  return registry.payloadsFor(owaspId).flatMap((rule) =>
    rule.payloads.map((p: RulePayload) => ({
      id: p.id,
      owaspId,
      name: p.name,
      description: p.description ?? p.name,
      template: p.template,
      ...(p.variables !== undefined ? { variables: p.variables } : {}),
      recommendedMutators: (p.recommendedMutators ?? ['none']) as RuleMutator[],
      multiTurn: p.multiTurn ?? false,
      threatLevel: p.threatLevel ?? 'medium',
      custom: true as const,
    }))
  );
}

/**
 * Merge helper used by the Attacker: built-in payloads first (stable,
 * canonical order), then custom payloads appended. Deduplicated by payload
 * id so a custom rule can never shadow or duplicate a built-in probe.
 */
export function mergePayloads<T extends { id: string }>(builtin: readonly T[], custom: readonly T[]): T[] {
  const seen = new Set(builtin.map((p) => p.id));
  const merged = [...builtin];
  for (const p of custom) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      merged.push(p);
    }
  }
  return merged;
}

/** Custom success indicators for an OWASP category. */
export function getCustomIndicators(owaspId: OwaspId): RuleIndicator[] {
  return registry.indicatorList(owaspId);
}

/** Custom severity override for an OWASP category (null when not set). */
export function getCustomSeverity(owaspId: OwaspId): Severity | null {
  return registry.severityFor(owaspId);
}

/** Registry introspection for CLI `rules list` and tests. */
export function getRuleStats(): RuleLoadStats & { files: string[] } {
  return registry.getStats();
}

/** Whether any custom rules are active. */
export function hasCustomRules(): boolean {
  return registry.getStats().rulesLoaded > 0;
}

/** Test-only: reset the global registry. */
export function resetRuleRegistryForTests(): void {
  registry.reset();
}
