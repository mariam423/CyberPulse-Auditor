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
export function isValidId(id) {
    return /^[a-z]+_[a-f0-9]{16,24}$/.test(id);
}
//# sourceMappingURL=ids.js.map