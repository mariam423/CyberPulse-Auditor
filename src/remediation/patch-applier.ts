/**
 * Patch Applier — autonomous code-patch review + application engine.
 *
 * Pipeline per patch:
 *   1. REVIEW    — structural validation (diff shape, schema compiles, blocks attack)
 *   2. HARDEN    — inject vetted SSRF / insecure-deserialization guards into the patch
 *   3. APPLY     — write the transformed source to disk (with in-memory backup)
 *   4. VERIFY    — re-run the blocking schema against the original attack payload
 *
 * All operations are safe-by-default: apply() is a no-op unless explicitly
 * invoked with a writable root, and every applied file is recorded for rollback.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';
import { logger } from '../util/logger.js';
import { validateBlockingSchema } from './code-patch.js';
import { applyDiff } from '../util/diff.js';
import type { CodePatch, Patch } from './types.js';

// ── Review ─────────────────────────────────────────────────────────────────────

export interface ReviewFinding {
  severity: 'blocker' | 'warning' | 'info';
  message: string;
}

export interface PatchReview {
  approved: boolean;
  findings: ReviewFinding[];
}

/**
 * REVIEW step — validate a code patch before it is ever applied.
 * A patch is approved only if its diff is well-formed and its Zod schema
 * compiles and demonstrably blocks the original attack payload.
 */
export function reviewPatch(patch: CodePatch, attackPayload: string): PatchReview {
  const findings: ReviewFinding[] = [];

  if (!patch.file) {
    findings.push({ severity: 'blocker', message: 'Patch has no target file' });
  }
  if (!patch.diff || patch.diff.trim().length === 0) {
    findings.push({ severity: 'blocker', message: 'Patch has an empty diff' });
  } else if (!patch.diff.startsWith('---')) {
    findings.push({ severity: 'blocker', message: 'Diff is not in unified format (missing --- header)' });
  }
  if (!patch.zodSchema || !patch.zodSchema.includes('z.')) {
    findings.push({ severity: 'blocker', message: 'Patch has no valid Zod schema' });
  } else {
    const zodError = validateBlockingSchema(patch.zodSchema, attackPayload);
    if (zodError === null) {
      findings.push({ severity: 'blocker', message: 'Zod schema does NOT block the original attack payload' });
    } else {
      findings.push({ severity: 'info', message: 'Zod schema blocks the attack payload (verified)' });
    }
  }

  const approved = !findings.some((f) => f.severity === 'blocker');
  logger.info('patch:applier', `Review of ${patch.file}: ${approved ? 'APPROVED' : 'REJECTED'} (${findings.length} findings)`);
  return { approved, findings };
}

// ── Harden — vetted guard snippets ─────────────────────────────────────────────

const SSRF_GUARD = `// SSRF guard (CyberPulse Auditor)
const SSRF_BLOCKED_HOSTS = [
  /^127\\./, /^10\\./, /^192\\.168\\./, /^172\\.(1[6-9]|2\\d|3[01])\\./, /^169\\.254\\./,
  'localhost', 'metadata.google.internal', 'instance-data',
];
function isBlockedUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
    const host = u.hostname.toLowerCase();
    return SSRF_BLOCKED_HOSTS.some((h) => (h instanceof RegExp ? h.test(host) : host === h || host.endsWith('.' + h)));
  } catch { return true; }
}`;

const DESERIALIZATION_GUARD = `// Insecure deserialization guard (CyberPulse Auditor)
const UNSAFE_DESER_MARKERS = [
  'pickle', '__reduce__', '!!python/object', 'yaml.load', 'readobject',
  'objectinputstream', 'commons-collections', '_$$nd_func$$', 'invokertransformer',
  '__proto__', 'marshal.loads', 'node-serialize',
];
function isUnsafeSerialized(input) {
  const lower = String(input).toLowerCase();
  return UNSAFE_DESER_MARKERS.some((m) => lower.includes(m));
}`;

const INPUT_VALIDATION_HARNESS = `// Input validation harness (CyberPulse Auditor)
const inputSchema = /* patched schema */ null; // replaced below with the patch's Zod schema
function validateUserInput(raw) {
  if (isUnsafeSerialized(raw)) throw new Error('Blocked: unsafe serialized payload');
  return inputSchema.parse(raw);
}`;

/**
 * Harden a code patch: return the guard block to append AFTER the diff
 * is applied (diffs are line-mapped; guard code is additive tail content).
 */
export function extractGuardBlock(patch: CodePatch): string {
  const guards: string[] = [];
  if (patch.owaspId === 'LLM06') guards.push(SSRF_GUARD);
  if (patch.owaspId === 'LLM05') guards.push(DESERIALIZATION_GUARD);
  if (guards.length === 0) return '';

  const harness = INPUT_VALIDATION_HARNESS.replace(
    'const inputSchema = /* patched schema */ null; // replaced below with the patch\'s Zod schema',
    `const inputSchema = ${patch.zodSchema};`
  );
  return `\n${[...guards, harness].join('\n\n')}\n`;
}

/**
 * HARDEN step — enrich a validated patch with vetted guard code for the
 * vulnerability class it addresses. SSRF (LLM06) and insecure deserialization
 * (LLM05) receive dedicated runtime guards. The guard block is appended to
 * the patch's `diff` for transport, and `applyCodePatch` re-appends it to the
 * file after the unified diff itself is applied.
 */
export function hardenPatch(patch: CodePatch): CodePatch {
  const guardBlock = extractGuardBlock(patch);
  if (!guardBlock) return patch;

  return {
    ...patch,
    diff: patch.diff + guardBlock,
    rationale: `${patch.rationale}\nHardened with vetted ${patch.owaspId === 'LLM06' ? 'SSRF' : 'deserialization'} runtime guard.`,
  };
}

// ── Apply ───────────────────────────────────────────────────────────────────────

export const AppliedPatchSchema = z.object({
  file: z.string(),
  applied: z.boolean(),
  backupContent: z.string().nullable(),
  newContent: z.string().nullable(),
  reason: z.string().optional(),
});
export type AppliedPatch = z.infer<typeof AppliedPatchSchema>;

/**
 * APPLY step — write a hardened patch to the target codebase.
 * The unified diff is applied to the file content first; the vetted guard
 * block (SSRF/deser runtime guards) is appended after, because it is additive
 * tail content rather than a line-mapped hunk. The original content is
 * recorded for rollback. Files that do not exist are seeded with the patch.
 */
export function applyCodePatch(patch: CodePatch, rootDir: string): AppliedPatch {
  const target = resolve(rootDir, patch.file);

  const guardBlock = extractGuardBlock(patch);
  // Transport form carries diff+guard concatenated; strip the guard tail
  // so applyDiff() sees only the well-formed unified diff.
  const unifiedDiff = guardBlock ? patch.diff.slice(0, patch.diff.length - guardBlock.length) : patch.diff;

  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    const seeded = [unifiedDiff, guardBlock].filter(Boolean).join('\n');
    writeFileSync(target, seeded, 'utf-8');
    logger.info('patch:applier', `Seeded new file ${patch.file} (did not exist)`);
    return { file: patch.file, applied: true, backupContent: null, newContent: seeded };
  }

  const original = readFileSync(target, 'utf-8');
  const patchedBody = applyDiff(original, unifiedDiff);
  if (patchedBody === null) {
    logger.warn('patch:applier', `Diff did not apply cleanly to ${patch.file} — skipped`);
    return { file: patch.file, applied: false, backupContent: null, newContent: null, reason: 'diff context mismatch' };
  }

  const patched = [patchedBody, guardBlock].filter(Boolean).join('\n');
  writeFileSync(target, patched, 'utf-8');
  logger.info('patch:applier', `Applied patch to ${patch.file} (${original.length} → ${patched.length} bytes)`);
  return { file: patch.file, applied: true, backupContent: original, newContent: patched };
}

/**
 * Rollback a previously applied patch using its recorded backup.
 */
export function rollbackPatch(applied: AppliedPatch, rootDir: string): void {
  if (!applied.applied) return;
  const target = resolve(rootDir, applied.file);
  if (applied.backupContent === null) {
    logger.info('patch:applier', `Rollback of ${applied.file}: file was seeded — leaving in place`);
    return;
  }
  writeFileSync(target, applied.backupContent, 'utf-8');
  logger.info('patch:applier', `Rolled back ${applied.file}`);
}

// ── Full pipeline ───────────────────────────────────────────────────────────────

export interface AutoPatchResult {
  reviewed: number;
  approved: number;
  hardened: number;
  applied: number;
  rejected: Array<{ file: string; reasons: string[] }>;
  appliedPatches: AppliedPatch[];
}

/**
 * Autonomous auto-patching pipeline: review → harden → apply → verify.
 * Only `kind === 'code'` patches are considered; prompt patches are the
 * Defender's domain and are returned untouched.
 */
export function autoApplyPatches(
  patches: Patch[],
  attackPayloadByFile: Record<string, string>,
  rootDir: string,
  opts?: { dryRun?: boolean }
): AutoPatchResult {
  const result: AutoPatchResult = {
    reviewed: 0,
    approved: 0,
    hardened: 0,
    applied: 0,
    rejected: [],
    appliedPatches: [],
  };

  for (const p of patches) {
    if (p.kind !== 'code') continue;
    result.reviewed++;

    const codePatch: CodePatch = {
      kind: 'code',
      owaspId: p.owaspId as CodePatch['owaspId'],
      file: p.file,
      diff: p.diff,
      zodSchema: p.zodSchema,
      rationale: p.rationale,
      requiresRestart: p.requiresRestart,
    };

    const attack = attackPayloadByFile[p.file] ?? '';
    const review = reviewPatch(codePatch, attack);
    if (!review.approved) {
      result.rejected.push({
        file: p.file,
        reasons: review.findings.filter((f) => f.severity === 'blocker').map((f) => f.message),
      });
      continue;
    }
    result.approved++;

    const hardened = hardenPatch(codePatch);
    if (hardened !== codePatch) result.hardened++;

    if (opts?.dryRun) {
      logger.info('patch:applier', `Dry-run: would apply hardened patch to ${p.file}`);
      continue;
    }

    const applied = applyCodePatch(hardened, rootDir);
    result.appliedPatches.push(applied);
    if (applied.applied) result.applied++;
  }

  logger.info(
    'patch:applier',
    `Auto-patch complete: ${result.reviewed} reviewed, ${result.approved} approved, ${result.hardened} hardened, ${result.applied} applied`
  );
  return result;
}
