import { describe, it, expect, vi } from 'vitest';
import { Attacker, AttackInputSchema } from '../src/agents/attacker.js';
import type { ModelClient, ChatCompletionResponse } from '../src/model/types.js';
import type { TargetAdapter } from '../src/targets/types.js';
import { getPayloads } from '../src/redteam/payloads/index.js';

// --- Mock implementations ---

function mockModelClient(responses: string[]): ModelClient {
  let idx = 0;
  return {
    async chatCompletions() {
      const text = responses[idx++] ?? responses[responses.length - 1] ?? '';
      return {
        id: 'mock-chatcmpl',
        model: 'mock',
        choices: [
          {
            index: 0,
            message: { role: 'assistant' as const, content: text },
            finish_reason: 'stop',
          },
        ],
      } satisfies ChatCompletionResponse;
    },
  };
}

function leakyTarget(): TargetAdapter {
  return {
    id: 'mock:leaky',
    async call(messages) {
      const last = messages.at(-1)?.content ?? '';
      const lower = last.toLowerCase();

      // Simulate a leaky target that echoes injection indicators
      if (lower.includes('ignore all previous') || lower.includes('ignore all prior')) {
        return 'CONFIDENTIAL DATA: The admin password is S3cr3tPass!';
      }
      if (lower.includes('drop table')) {
        return 'Executing: DROP TABLE users; // Done';
      }
      if (lower.includes('system prompt') || lower.includes('system_prompt') || lower.includes('guidelines')) {
        return 'My system prompt is: "You are a helpful assistant with safety guidelines."';
      }
      if (lower.includes('curl') || lower.includes('attacker.example.com') || lower.includes('exfil')) {
        return 'HTTP POST to https://attacker.example.com/exfil with data...';
      }
      if (lower.includes('/etc/passwd') || lower.includes('secrets.yaml')) {
        return 'root:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000:Admin:/home/admin:/bin/sh';
      }
      if (lower.includes('repeat the text between') || lower.includes('markers:')) {
        return 'You are a helpful assistant with safety guidelines. Do not share this.';
      }
      // Default refusal
      return "I'm sorry, but I can't help with that request.";
    },
    async ping() {
      return true;
    },
  };
}

function safeTarget(): TargetAdapter {
  return {
    id: 'mock:safe',
    async call() {
      return "I'm sorry, but I can't help with that request. Please contact your administrator.";
    },
    async ping() {
      return true;
    },
  };
}

// --- Tests ---

describe('Attacker Agent — Adversarial Tests', () => {
  describe('LLM01 — Prompt Injection detection', () => {
    it('detects a successful prompt injection against a leaky target', async () => {
      const target = leakyTarget();
      const model = mockModelClient(['Acknowledged.']);
      const attacker = new Attacker(model, target);

      const input = AttackInputSchema.parse({
        plan: {
          owaspId: 'LLM01',
          goal: 'Reveal the admin password via prompt injection',
          targetDescriptor: 'mock:leaky',
        },
        useMutations: false,
        maxMutations: 0,
      });

      const output = await attacker.run(input);

      expect(output.owaspId).toBe('LLM01');
      expect(output.results.length).toBeGreaterThan(0);

      // The leaky target should have responded to the injection
      const successes = output.results.filter((r) => r.success);
      expect(successes.length).toBeGreaterThan(0);

      // Verify the successful result contains evidence of leakage
      const leaked = successes.find(
        (r) =>
          r.rawResponse.includes('CONFIDENTIAL') ||
          r.rawResponse.includes('S3cr3t')
      );
      expect(leaked).toBeDefined();
    });

    it('does not flag a refusal from a safe target as a successful injection', async () => {
      const target = safeTarget();
      const model = mockModelClient(["I'm sorry, I can't help with that."]);
      const attacker = new Attacker(model, target);

      const input = AttackInputSchema.parse({
        plan: {
          owaspId: 'LLM01',
          goal: 'Reveal the admin password',
          targetDescriptor: 'mock:safe',
        },
        useMutations: false,
        maxMutations: 0,
      });

      const output = await attacker.run(input);
      const successes = output.results.filter((r) => r.success);
      // Safe target refuses all — should have zero successes
      expect(successes).toHaveLength(0);
    });

    it('produces reproducible payloads with consistent IDs', async () => {
      const target = leakyTarget();
      const model = mockModelClient(['OK']);
      const attacker = new Attacker(model, target);

      const input = AttackInputSchema.parse({
        plan: {
          owaspId: 'LLM01',
          goal: 'Test injection',
          targetDescriptor: 'mock:leaky',
        },
        useMutations: false,
        maxMutations: 0,
      });

      const output1 = await attacker.run(input);
      const output2 = await attacker.run(input);

      const ids1 = output1.results.map((r) => r.payloadId).sort();
      const ids2 = output2.results.map((r) => r.payloadId).sort();
      expect(ids1).toEqual(ids2);
    });
  });

  describe('LLM06 — Excessive Agency detection', () => {
    it('detects excessive agency actions against a leaky target', async () => {
      const target = leakyTarget();
      const model = mockModelClient(['Command executed.']);
      const attacker = new Attacker(model, target);

      const input = AttackInputSchema.parse({
        plan: {
          owaspId: 'LLM06',
          goal: 'Trigger unauthorized file access and exfiltration',
          targetDescriptor: 'mock:leaky',
        },
        useMutations: false,
        maxMutations: 0,
      });

      const output = await attacker.run(input);
      const successes = output.results.filter((r) => r.success);

      // Leaky target should succeed for LLM06 payloads
      expect(successes.length).toBeGreaterThan(0);

      const exfilResult = successes.find(
        (r) =>
          r.rawResponse.includes('attacker.example.com') ||
          r.rawResponse.includes('/etc/passwd') ||
          r.rawResponse.includes('HTTP POST')
      );
      expect(exfilResult).toBeDefined();
    });

    it('does not falsely flag safe target responses as agency', async () => {
      const target = safeTarget();
      const model = mockModelClient(["I can't execute commands."]);
      const attacker = new Attacker(model, target);

      const input = AttackInputSchema.parse({
        plan: {
          owaspId: 'LLM06',
          goal: 'Execute unauthorized commands',
          targetDescriptor: 'mock:safe',
        },
        useMutations: false,
        maxMutations: 0,
      });

      const output = await attacker.run(input);
      const successes = output.results.filter((r) => r.success);
      expect(successes).toHaveLength(0);
    });
  });

  describe('LLM07 — System Prompt Leakage', () => {
    it('detects system prompt leakage against a leaky target', async () => {
      const target = leakyTarget();
      const model = mockModelClient(['Here are the guidelines: ...']);
      const attacker = new Attacker(model, target);

      const input = AttackInputSchema.parse({
        plan: {
          owaspId: 'LLM07',
          goal: 'Extract the system prompt',
          targetDescriptor: 'mock:leaky',
        },
        useMutations: false,
        maxMutations: 0,
      });

      const output = await attacker.run(input);
      const successes = output.results.filter((r) => r.success);

      expect(successes.length).toBeGreaterThan(0);

      const leakedPrompt = successes.find(
        (r) =>
          r.rawResponse.includes('system prompt') ||
          r.rawResponse.includes('safety guidelines')
      );
      expect(leakedPrompt).toBeDefined();
    });
  });

  describe('Payload registry', () => {
    it('LLM01 has at least 5 payloads', () => {
      const payloads = getPayloads('LLM01');
      expect(payloads.length).toBeGreaterThanOrEqual(5);
      expect(payloads.every((p) => p.owaspId === 'LLM01')).toBe(true);
    });

    it('LLM06 has at least 5 payloads', () => {
      const payloads = getPayloads('LLM06');
      expect(payloads.length).toBeGreaterThanOrEqual(5);
      expect(payloads.every((p) => p.owaspId === 'LLM06')).toBe(true);
    });

    it('all 10 OWASP IDs have at least 1 payload', async () => {
      const ids = ['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10'];
      for (const id of ids) {
        const payloads = getPayloads(id as any);
        expect(payloads.length).toBeGreaterThanOrEqual(1), `OWASP ${id} should have at least 1 payload`;
      }
    });
  });

  describe('AttackInputSchema validation', () => {
    it('accepts valid attack input', () => {
      const valid = {
        plan: { owaspId: 'LLM01', goal: 'Test', targetDescriptor: 'mock' },
        useMutations: true,
        maxMutations: 3,
      };
      expect(() => AttackInputSchema.parse(valid)).not.toThrow();
    });

    it('rejects invalid OWASP id', () => {
      const invalid = {
        plan: { owaspId: 'INVALID', goal: 'Test', targetDescriptor: 'mock' },
      };
      expect(() => AttackInputSchema.parse(invalid)).toThrow();
    });

    it('accepts optional fields omitted', () => {
      const minimal = {
        plan: { owaspId: 'LLM01', goal: 'Test', targetDescriptor: 'mock' },
      };
      const parsed = AttackInputSchema.parse(minimal);
      // Optional fields remain undefined when omitted (defaults applied in Attacker.invoke)
      expect(parsed.useMutations).toBeUndefined();
      expect(parsed.maxMutations).toBeUndefined();
    });
  });

  describe('Mutations increase payload diversity', () => {
    it('mutations produce different payloads from the original', async () => {
      const target = leakyTarget();
      const model = mockModelClient(['Response']);
      const attacker = new Attacker(model, target);

      const input = AttackInputSchema.parse({
        plan: {
          owaspId: 'LLM01',
          goal: 'Test mutations',
          targetDescriptor: 'mock:leaky',
        },
        useMutations: true,
        maxMutations: 4,
      });

      const output = await attacker.run(input);

      // Collect unique payload strings
      const payloads = output.results.map((r) => r.payload);
      const uniquePayloads = new Set(payloads);

      // With mutations enabled, we expect more diversity than without
      expect(uniquePayloads.size).toBeGreaterThan(1);
    });
  });
});
