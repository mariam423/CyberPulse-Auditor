import type { OwaspEntry, OwaspId } from './types.js';
export declare function loadCatalog(seedPath?: string): Map<OwaspId, OwaspEntry>;
export declare function getEntry(id: OwaspId): OwaspEntry | undefined;
export declare function getAllEntries(): OwaspEntry[];
export declare function resetCatalog(): void;
