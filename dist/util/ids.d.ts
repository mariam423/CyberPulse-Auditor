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
export declare function isValidId(id: string): boolean;
