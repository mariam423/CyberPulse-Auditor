import { z, ZodError } from 'zod';
import { logger } from '../util/logger.js';
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
  diffLines?: { old: string[]; new: string[] };
  rationale: string;
}

/**
 * Build a Zod schema that blocks the given attack payload.
 * Uses keyword detection + pattern matching to create a rejection rule.
 */
export function buildBlockingSchema(attackPayload: string, _legitimateExample: string): string {
  // Extract key suspicious phrases from the attack payload
  const suspiciousPhrases: string[] = [];

  // Split into words/phrases and find those that look dangerous
  const words = attackPayload.split(/\s+/);
  const dangerousPatterns = [
    /ignore\s+(all\s+)?(previous|prior)/i,
    /system\s*prompt/i,
    /drop\s+table/i,
    /chmod\s+777/i,
    /rm\s+-rf/i,
    /sudo/i,
    /etc\/passwd/i,
    /secrets\.yaml/i,
    /attacker\./i,
    /169\.254\.169\.254/i,
    /\{\{.*\}\}/i, // template injection
    // SSRF
    /169\.254\./i,
    /10\.0\.0\.\d+/i,
    /127\.0\.0\.1/i,
    /localhost:\d+/i,
    /192\.168\.\d+/i,
    /172\.16\.\d+/i,
    /metadata/i,
    /iam\/security-credentials/i,
    /redirect\?url=/i,
    /%31%32%37/i,
    // Insecure deserialization
    /pickle/i,
    /__reduce__/i,
    /!!python\/object/i,
    /yaml\.load/i,
    /objectinputstream/i,
    /readobject/i,
    /commons-collections/i,
    /node-serialize/i,
    /_\$\$nd_func\$\$/i,
    /__proto__/i,
    /invokertransformer/i,
    /deserializ/i,
    /unmarshal/i,
  ];

  for (const word of words) {
    for (const pattern of dangerousPatterns) {
      if (pattern.test(word)) {
        suspiciousPhrases.push(word);
        break;
      }
    }
  }

  if (suspiciousPhrases.length === 0) {
    // Fallback: block exact string match
    return `z.string().refine(val => val !== ${JSON.stringify(attackPayload.slice(0, 100))}, "Blocked input pattern detected")`;
  }

  // Build a Zod schema that rejects inputs containing any of the suspicious phrases
  const conditions = suspiciousPhrases.map(
    (phrase) =>
      `val.toLowerCase().includes(${JSON.stringify(phrase.toLowerCase())})`
  );

  return `z.string().refine(val => !(${conditions.join(' || ')}), "Blocked input pattern detected: suspicious content")`;
}

/**
 * Generate a minimal unified diff for a code change.
 */
export function generateDiff(
  file: string,
  oldLines: string[],
  newLines: string[]
): string {
  if (oldLines.join('\n') === newLines.join('\n')) return '';

  const hunks = computeDiffHunks(oldLines, newLines);
  const lines: string[] = [];
  lines.push(`--- ${file}`);
  lines.push(`+++ ${file}`);

  for (const hunk of hunks) {
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
    );
    lines.push(...hunk.body);
  }

  return lines.join('\n');
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  body: string[];
}

function computeDiffHunks(oldLines: string[], newLines: string[]): DiffHunk[] {
  const CONTEXT = 3;
  const oldLen = oldLines.length;
  const newLen = newLines.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: oldLen + 1 }, () =>
    new Array(newLen + 1).fill(0)
  );
  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = (dp[i - 1]![j - 1] ?? 0) + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j] ?? 0, dp[i]![j - 1] ?? 0);
      }
    }
  }

  // Backtrack to find the edit script
  type Edit = { type: 'keep' | 'delete' | 'insert'; oldIdx?: number; newIdx?: number; content: string };
  const edits: Edit[] = [];
  let i = oldLen;
  let j = newLen;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.unshift({ type: 'keep', oldIdx: i, newIdx: j, content: oldLines[i - 1]! });
      i--; j--;
    } else if (j > 0 && (i === 0 || (dp[i]![j - 1] ?? 0) >= (dp[i - 1]![j] ?? 0))) {
      edits.unshift({ type: 'insert', newIdx: j, content: newLines[j - 1]! });
      j--;
    } else {
      edits.unshift({ type: 'delete', oldIdx: i, content: oldLines[i - 1]! });
      i--;
    }
  }

  // Group into hunks
  const hunks: DiffHunk[] = [];
  let editI = 0;

  while (editI < edits.length) {
    // Find next change
    while (editI < edits.length && edits[editI]?.type === 'keep') editI++;
    if (editI >= edits.length) break;

    const changeStart = Math.max(0, editI - CONTEXT);
    let editEnd = editI;

    while (editEnd < edits.length && edits[editEnd]?.type !== 'keep') editEnd++;
    const contextEnd = Math.min(edits.length, editEnd + CONTEXT);

    // Build hunk body
    const body: string[] = [];
    for (let k = changeStart; k < contextEnd; k++) {
      const e = edits[k];
      if (!e) continue;
      if (e.type === 'keep') body.push(` ${e.content}`);
      else if (e.type === 'delete') body.push(`-${e.content}`);
      else if (e.type === 'insert') body.push(`+${e.content}`);
    }

    const keepEdits = edits.slice(changeStart, contextEnd).filter((e) => e?.type === 'keep');
    const firstKeep = keepEdits[0];

    const oldStart = firstKeep?.oldIdx ?? 1;
    const oldCount = body.filter((l) => !l.startsWith('+')).length;
    const newStart = firstKeep?.newIdx ?? 1;
    const newCount = body.filter((l) => !l.startsWith('-')).length;

    hunks.push({ oldStart, oldLines: oldCount, newStart, newLines: newCount, body });

    editI = editEnd;
  }

  return hunks;
}

/**
 * Create a CodePatch for a given vulnerability.
 * Generates both the diff and the blocking Zod schema.
 */
export function createCodePatch(opts: CodePatchOptions): CodePatch {
  const { owaspId, file, attackPayload, legitimateExample, rationale } = opts;
  const zodSchema = buildBlockingSchema(attackPayload, legitimateExample);

  // Build default diff from a template (in a real scenario, this would be extracted from the actual file)
  const diff = generateDiff(
    file,
    [
      `// BEFORE (vulnerable)`,
      `function processInput(userInput: string) {`,
      `  // No validation`,
      `  execute(userInput);`,
      `}`,
    ],
    [
      `// AFTER (hardened)`,
      `function processInput(userInput: string) {`,
      `  // Input validated by Zod schema`,
      `  const schema = ${zodSchema};`,
      `  try { schema.parse(userInput); } catch { return; }`,
      `  execute(userInput);`,
      `}`,
    ]
  );

  return {
    kind: 'code',
    owaspId: owaspId as CodePatch['owaspId'],
    file,
    diff,
    zodSchema,
    rationale,
    requiresRestart: false,
  };
}

/**
 * Validate that a given Zod schema actually blocks the attack payload.
 * Returns an error if the schema passes the attack payload (i.e., it's not actually blocking).
 */
export function validateBlockingSchema(schemaSource: string, attackPayload: string): ZodError | null {
  try {
    const schemaFn = new Function('z', `return ${schemaSource}`);
    const schema = schemaFn(z);
    schema.parse(attackPayload);
    // If we get here, the schema PASSED the attack — it's NOT blocking
    logger.warn('code-patch', 'Schema does NOT block the attack payload');
    return null;
  } catch (err) {
    if (err instanceof ZodError) {
      logger.info('code-patch', 'Schema correctly blocks attack payload');
      return err;
    }
    // Syntax error in schema
    logger.error('code-patch', 'Invalid Zod schema', err);
    return null;
  }
}
