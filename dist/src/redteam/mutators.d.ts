import type { AttackPayload, MutatedPayload, PayloadMutator } from './types.js';
/**
 * Payload mutators — apply transformations to base payloads
 * to evade simple detection filters.
 */
export declare const mutators: {
    readonly none: (_payload: AttackPayload) => string;
    readonly base64: (payload: AttackPayload) => string;
    readonly hex: (payload: AttackPayload) => string;
    readonly 'url-encode': (payload: AttackPayload) => string;
    readonly 'unicode-escape': (payload: AttackPayload) => string;
    readonly 'role-play': (payload: AttackPayload) => string;
    readonly framing: (payload: AttackPayload) => string;
    readonly 'multi-turn-chain': (payload: AttackPayload) => string;
    readonly 'context-injection': (payload: AttackPayload) => string;
};
export declare function applyMutator(payload: AttackPayload, mutator: PayloadMutator): string;
export declare function mutate(payload: AttackPayload, mutationList: PayloadMutator[]): MutatedPayload;
export declare function generateMutations(payload: AttackPayload, count?: number): MutatedPayload[];
