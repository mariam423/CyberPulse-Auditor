import { z } from 'zod';
import type { OwaspId } from '../owasp/types.js';

export const PayloadMutator = z.enum([
  'none',
  'base64',
  'hex',
  'url-encode',
  'unicode-escape',
  'role-play',
  'framing',
  'multi-turn-chain',
  'context-injection',
]);
export type PayloadMutator = z.infer<typeof PayloadMutator>;

export interface AttackPayload {
  id: string;
  owaspId: OwaspId;
  name: string;
  description: string;
  /** Primary injection text */
  template: string;
  /** Variables to substitute in the template */
  variables?: Record<string, string>;
  /** Recommended mutators to apply */
  recommendedMutators: PayloadMutator[];
  /** Whether this payload is multi-turn (vs single-shot) */
  multiTurn: boolean;
  /** Threat level of this payload */
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface MutatedPayload {
  original: AttackPayload;
  mutations: PayloadMutator[];
  result: string;
}

export interface AttackPlan {
  owaspId: OwaspId;
  payloads: AttackPayload[];
  goal: string;
  targetDescriptor: string;
}

export interface AttackTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AttackResult {
  transcript: AttackTurn[];
  rawResponse: string;
  success: boolean;
  error?: string;
}

export interface AttackRun {
  plan: AttackPlan;
  results: AttackResult[];
  startTime: Date;
  endTime?: Date;
}
