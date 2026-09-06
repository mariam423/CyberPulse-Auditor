/**
 * Minimal unified-diff generator and parser.
 * Produces and consumes `diff` strings used in CodePatch objects.
 */
export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    body: string[];
}
export interface FileDiff {
    oldPath: string;
    newPath: string;
    hunks: DiffHunk[];
}
export declare function parseUnifiedDiff(diff: string): FileDiff | null;
export declare function buildUnifiedDiff(oldPath: string, newPath: string, oldLines: string[], newLines: string[]): string;
export declare function applyDiff(original: string, diff: string): string | null;
