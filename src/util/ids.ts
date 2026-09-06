import { randomBytes } from 'node:crypto';

export type RunId = string & { readonly __brand: unique symbol };
export type FindingId = string & { readonly __brand: unique symbol };
export type PatchId = string & { readonly __brand: unique symbol };
export type RetestId = string & { readonly __brand: unique symbol };

function brand<T>(value: string): T {
  return value as T;
}

export function newRunId(): RunId {
  return brand(`run_${randomBytes(12).toString('hex')}`);
}

export function newFindingId(): FindingId {
  return brand(`fnd_${randomBytes(8).toString('hex')}`);
}

export function newPatchId(): PatchId {
  return brand(`pat_${randomBytes(8).toString('hex')}`);
}

export function newRetestId(): RetestId {
  return brand(`ret_${randomBytes(8).toString('hex')}`);
}

export function isValidId(id: string): boolean {
  return /^[a-z]+_[a-f0-9]{16,24}$/.test(id);
}
