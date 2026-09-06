import type { AttackPayload } from '../types.js';
import type { OwaspId } from '../../owasp/types.js';

import { LLM01_PAYLOADS } from './llm01-prompt-injection.js';
import { LLM02_PAYLOADS } from './llm02-insecure-output.js';
import { LLM03_PAYLOADS } from './llm03-training-data-poisoning.js';
import { LLM04_PAYLOADS } from './llm04-model-dos.js';
import { LLM05_PAYLOADS } from './llm05-supply-chain.js';
import { LLM06_PAYLOADS } from './llm06-excessive-agency.js';
import { LLM07_PAYLOADS } from './llm07-system-prompt-leak.js';
import { LLM08_PAYLOADS } from './llm08-embedding-weaknesses.js';
import { LLM09_PAYLOADS } from './llm09-misinformation.js';
import { LLM10_PAYLOADS } from './llm10-model-theft.js';

const PAYLOAD_REGISTRY: Record<OwaspId, AttackPayload[]> = {
  LLM01: LLM01_PAYLOADS,
  LLM02: LLM02_PAYLOADS,
  LLM03: LLM03_PAYLOADS,
  LLM04: LLM04_PAYLOADS,
  LLM05: LLM05_PAYLOADS,
  LLM06: LLM06_PAYLOADS,
  LLM07: LLM07_PAYLOADS,
  LLM08: LLM08_PAYLOADS,
  LLM09: LLM09_PAYLOADS,
  LLM10: LLM10_PAYLOADS,
};

export { PAYLOAD_REGISTRY };

export function getPayloads(owaspId: OwaspId): AttackPayload[] {
  return PAYLOAD_REGISTRY[owaspId] ?? [];
}

export function getAllPayloads(): AttackPayload[] {
  return Object.values(PAYLOAD_REGISTRY).flat();
}

export function getPayloadById(id: string): AttackPayload | undefined {
  for (const payloads of Object.values(PAYLOAD_REGISTRY)) {
    const found = payloads.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}

export { LLM01_PAYLOADS, LLM06_PAYLOADS };
export type { AttackPayload };
