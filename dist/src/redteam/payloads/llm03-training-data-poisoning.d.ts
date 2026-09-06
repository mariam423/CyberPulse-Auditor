import type { AttackPayload } from '../types.js';
/**
 * LLM03 — Training Data Poisoning
 * Probes for detecting whether external data inputs could poison model behavior.
 * These are primarily evaluated by behavioral changes over time, not single-turn responses.
 */
export declare const LLM03_PAYLOADS: AttackPayload[];
