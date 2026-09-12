import { randomBytes } from 'node:crypto';
function brand(value) {
    return value;
}
export function newRunId() {
    return brand(`run_${randomBytes(12).toString('hex')}`);
}
export function newFindingId() {
    return brand(`fnd_${randomBytes(8).toString('hex')}`);
}
export function newPatchId() {
    return brand(`pat_${randomBytes(8).toString('hex')}`);
}
export function newRetestId() {
    return brand(`ret_${randomBytes(8).toString('hex')}`);
}
/** Re-brand an untrusted/raw string as a branded ID (CLI input, DB rows). */
export function asRunId(id) {
    return brand(id);
}
export function asFindingId(id) {
    return brand(id);
}
export function asPatchId(id) {
    return brand(id);
}
export function asRetestId(id) {
    return brand(id);
}
export function isValidId(id) {
    return /^[a-z]+_[a-f0-9]{16,24}$/.test(id);
}
//# sourceMappingURL=ids.js.map