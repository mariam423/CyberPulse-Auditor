/**
 * Minimal unified-diff generator and parser.
 * Produces and consumes `diff` strings used in CodePatch objects.
 */
export function parseUnifiedDiff(diff) {
    const lines = diff.split('\n');
    if (lines.length < 4 || !lines[0]?.startsWith('---') || !lines[1]?.startsWith('+++')) {
        return null;
    }
    const oldPath = lines[0].substring(4).trim();
    const newPath = lines[1].substring(4).trim();
    const hunks = [];
    let i = 2;
    while (i < lines.length) {
        const hunkMatch = lines[i]?.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!hunkMatch) {
            i++;
            continue;
        }
        const hunk = {
            oldStart: parseInt(hunkMatch[1], 10),
            oldLines: parseInt(hunkMatch[2] ?? '1', 10),
            newStart: parseInt(hunkMatch[3], 10),
            newLines: parseInt(hunkMatch[4] ?? '1', 10),
            body: [],
        };
        i++;
        while (i < lines.length && !lines[i]?.startsWith('@@')) {
            if (lines[i])
                hunk.body.push(lines[i]);
            i++;
        }
        hunks.push(hunk);
    }
    return { oldPath, newPath, hunks };
}
export function buildUnifiedDiff(oldPath, newPath, oldLines, newLines) {
    const hunks = computeHunks(oldLines, newLines);
    if (hunks.length === 0)
        return '';
    const lines = [];
    lines.push(`--- ${oldPath}`);
    lines.push(`+++ ${newPath}`);
    for (const hunk of hunks) {
        lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
        lines.push(...hunk.body);
    }
    return lines.join('\n');
}
function computeHunks(oldLines, newLines) {
    // LCS-based diff — simplified O(ND) algorithm
    const hunks = [];
    const oldLen = oldLines.length;
    const newLen = newLines.length;
    // Build LCS table
    const dp = Array.from({ length: oldLen + 1 }, () => new Array(newLen + 1).fill(0));
    for (let i = 1; i <= oldLen; i++) {
        for (let j = 1; j <= newLen; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    // Backtrack to find hunks
    let i = oldLen;
    let j = newLen;
    const edits = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            edits.unshift({ type: 'keep', oldLine: i, newLine: j, content: oldLines[i - 1] });
            i--;
            j--;
        }
        else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            edits.unshift({ type: 'insert', newLine: j, content: newLines[j - 1] });
            j--;
        }
        else {
            edits.unshift({ type: 'delete', oldLine: i, content: oldLines[i - 1] });
            i--;
        }
    }
    // Group edits into hunks with context
    const CONTEXT = 3;
    let hunkStart = 0;
    let oldStart = 1;
    let newStart = 1;
    function flushHunk(start, end, oStart, nStart) {
        if (end <= start)
            return;
        const body = edits.slice(start, end).map((e) => {
            if (e.type === 'keep')
                return ` ${e.content}`;
            if (e.type === 'delete')
                return `-${e.content}`;
            return `+${e.content}`;
        });
        hunks.push({
            oldStart: oStart,
            oldLines: body.filter((l) => !l.startsWith('+')).length,
            newStart: nStart,
            newLines: body.filter((l) => !l.startsWith('-')).length,
            body,
        });
    }
    let editEnd = 0;
    for (let k = 0; k < edits.length; k++) {
        if (edits[k]?.type !== 'keep') {
            const hunkBegin = Math.max(0, k - CONTEXT);
            const hunkEnd = Math.min(edits.length, k + CONTEXT);
            if (hunkEnd - hunkBegin > (hunkEnd - hunkBegin)) {
                // gap detected — flush previous
                flushHunk(hunkStart, editEnd, oldStart, newStart);
                hunkStart = hunkBegin;
                oldStart = edits[hunkBegin]?.oldLine ?? 1;
                newStart = edits[hunkBegin]?.newLine ?? 1;
            }
            editEnd = k;
        }
    }
    flushHunk(hunkStart, edits.length, 1, 1);
    return hunks;
}
export function applyDiff(original, diff) {
    const fileDiff = parseUnifiedDiff(diff);
    if (!fileDiff)
        return null;
    const lines = original.split('\n');
    const result = [];
    let oldIdx = 0; // 0-based index into original lines
    for (const hunk of fileDiff.hunks) {
        // Copy lines before this hunk
        while (oldIdx < hunk.oldStart - 1) {
            result.push(lines[oldIdx]);
            oldIdx++;
        }
        // Apply hunk body
        let newIdx = hunk.newStart - 1;
        for (const line of hunk.body) {
            if (line.startsWith(' ') || line.startsWith('\\')) {
                // context line
                result.push(lines[oldIdx] ?? '');
                oldIdx++;
                newIdx++;
            }
            else if (line.startsWith('-')) {
                // deleted line
                oldIdx++;
            }
            else if (line.startsWith('+')) {
                // added line
                result.push(line.substring(1));
                newIdx++;
            }
        }
    }
    // Copy remaining lines
    while (oldIdx < lines.length) {
        result.push(lines[oldIdx]);
        oldIdx++;
    }
    return result.join('\n');
}
//# sourceMappingURL=diff.js.map