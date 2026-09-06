import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OwaspEntrySchema } from './types.js';
import { logger } from '../util/logger.js';
let catalog = null;
export function loadCatalog(seedPath) {
    if (catalog)
        return catalog;
    const path = seedPath ?? resolve(process.cwd(), 'data/seed/owasp-llm-top10.json');
    logger.info('owasp:catalog', `Loading OWASP catalog from ${path}`);
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const entries = OwaspEntrySchema.array().parse(raw);
    catalog = new Map(entries.map((e) => [e.id, e]));
    logger.info('owasp:catalog', `Loaded ${catalog.size} OWASP entries`);
    return catalog;
}
export function getEntry(id) {
    return loadCatalog().get(id);
}
export function getAllEntries() {
    return Array.from(loadCatalog().values());
}
export function resetCatalog() {
    catalog = null;
}
//# sourceMappingURL=catalog.js.map