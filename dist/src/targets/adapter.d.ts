import type { TargetAdapter } from './types.js';
export { TargetConfigSchema } from './types.js';
export type { TargetConfig, TargetAdapter, TargetTurn, AttackTranscript } from './types.js';
export declare function createTargetAdapter(config: unknown): TargetAdapter;
