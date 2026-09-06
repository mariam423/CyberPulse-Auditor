import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OwaspEntry, OwaspId } from './types.js';
import { OwaspEntrySchema } from './types.js';
import { logger } from '../util/logger.js';

let catalog: Map<OwaspId, OwaspEntry> | null = null;

export function loadCatalog(seedPath?: string): Map<OwaspId, OwaspEntry> {
  if (catalog) return catalog;

  const path = seedPath ?? resolve(process.cwd(), 'data/seed/owasp-llm-top10.json');
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
