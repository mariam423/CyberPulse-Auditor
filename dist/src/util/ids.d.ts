export type RunId = string & {
    readonly __brand: unique symbol;
};
export type FindingId = string & {
    readonly __brand: unique symbol;
};
export type PatchId = string & {
    readonly __brand: unique symbol;
};
export type RetestId = string & {
    readonly __brand: unique symbol;
};
export declare function newRunId(): RunId;
export declare function newFindingId(): FindingId;
export declare function newPatchId(): PatchId;
export declare function newRetestId(): RetestId;
/** Re-brand an untrusted/raw string as a branded ID (CLI input, DB rows). */
export declare function asRunId(id: string): RunId;
export declare function asFindingId(id: string): FindingId;
export declare function asPatchId(id: string): PatchId;
export declare function asRetestId(id: string): RetestId;
export declare function isValidId(id: string): boolean;
