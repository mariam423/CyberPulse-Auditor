import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OwaspEntry, OwaspId } from './types.js';
import { OwaspEntrySchema } from './types.js';
import { logger } from '../util/logger.js';

let catalog: Map<OwaspId, OwaspEntry> | null = null;

/**
 * Resolve the packaged OWASP seed file relative to THIS module, not cwd —
 * `cyberpulse` must work from any directory (global install, cron, CI).
 * Walks upward from the module directory until data/seed is located,
 * so it works identically for src/ (dev) and dist/src/ (compiled) layouts.
 */
function defaultSeedPath(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, 'data/seed/owasp-llm-top10.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Final fallback: cwd-relative (repo root) — preserves the legacy default.
  return resolve(process.cwd(), 'data/seed/owasp-llm-top10.json');
}

export function loadCatalog(seedPath?: string): Map<OwaspId, OwaspEntry> {
  if (catalog) return catalog;

  const path = seedPath ?? defaultSeedPath();
  logger.info('owasp:catalog', `Loading OWASP catalog from ${path}`);

  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  const entries = OwaspEntrySchema.array().parse(raw);

  catalog = new Map(entries.map((e) => [e.id, e]));
  logger.info('owasp:catalog', `Loaded ${catalog.size} OWASP entries`);
  return catalog;
}

export function getEntry(id: OwaspId): OwaspEntry | undefined {
  return loadCatalog().get(id);
}

export function getAllEntries(): OwaspEntry[] {
  return Array.from(loadCatalog().values());
}

export function resetCatalog(): void {
  catalog = null;
}
