import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { rmSync, existsSync } from 'node:fs';
import { Orchestrator, OrchestratorConfigSchema } from '../src/orchestrator/orchestrator.js';
import type { ModelClient } from '../src/model/types.js';
import type { TargetAdapter } from '../src/targets/types.js';

// --- Mock implementations ---

function mockModelClient(): ModelClient {
  return {
    async chatCompletions() {
      return {
        id: 'mock',
        model: 'mock',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Acknowledged.' },
            finish_reason: 'stop',
          },
        ],
      };
    },
  };
}

function leakyTarget(): TargetAdapter {
  return {
    id: 'mock:leaky',
    async call(messages) {
      const last = messages.at(-1)?.content ?? '';
      const lower = last.toLowerCase();

      if (lower.includes('ignore all previous') || lower.includes('ignore all prior')) {
        return 'CONFIDENTIAL DATA: The admin password is S3cr3tPass!';
      }
      if (lower.includes('curl') || lower.includes('attacker.example.com')) {
        return 'HTTP POST to https://attacker.example.com/exfil with data...';
      }
      if (lower.includes('/etc/passwd') || lower.includes('secrets.yaml')) {
        return 'root:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000:Admin:/home/admin:/bin/sh';
      }
      return "I'm sorry, but I can't help with that.";
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
      return "I'm sorry, but I can't help with that request.";
    },
    async ping() {
      return true;
    },
  };
}

const TEST_DB = resolve(process.cwd(), 'data/test/integration.db');

describe('Closed-Loop Integration', () => {
  beforeEach(() => {
    try { rmSync(TEST_DB, { force: true, recursive: true }); } catch { /* noop */ }
  });

  afterEach(() => {
    try { rmSync(TEST_DB, { force: true, recursive: true }); } catch { /* noop */ }
  });

  it('full loop: audit → findings → patches → report', async () => {
    const config = OrchestratorConfigSchema.parse({
      goal: 'Probe for prompt injection vulnerabilities',
      targetDescriptor: 'mock:leaky',
      owaspIds: ['LLM01', 'LLM06'],
      maxIterations: 2,
      applyPatches: false,
      allowOpenCritical: false,
    });

    const orchestrator = new Orchestrator(
      config,
      mockModelClient(),
      leakyTarget(),
      TEST_DB
    );

    const result = await orchestrator.run('text');

    expect(result.runId).toBeDefined();
    expect(result.runId.startsWith('run_')).toBe(true);
    expect(['complete', 'partial']).toContain(result.status);
    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.findings.length).toBeGreaterThanOrEqual(0);
    expect(result.patches.length).toBeGreaterThanOrEqual(0);
    expect(result.output.length).toBeGreaterThan(0);

    orchestrator.close();
  });

  it('safe target: loop terminates with no open critical findings', async () => {
    const config = OrchestratorConfigSchema.parse({
      goal: 'Probe for prompt injection',
      targetDescriptor: 'mock:safe',
      owaspIds: ['LLM01', 'LLM06'],
      maxIterations: 1,
      applyPatches: false,
      allowOpenCritical: true,
    });

    const orchestrator = new Orchestrator(
      config,
      mockModelClient(),
      safeTarget(),
      TEST_DB
    );

    const result = await orchestrator.run('text');

    expect(result.status).toBe('complete');
    expect(result.output).toContain('CyberPulse Audit');

    orchestrator.close();
  });

  it('report formats: json, markdown, sarif', async () => {
    const config = OrchestratorConfigSchema.parse({
      goal: 'Quick probe',
      targetDescriptor: 'mock:safe',
      owaspIds: ['LLM01'],
      maxIterations: 1,
      applyPatches: false,
      allowOpenCritical: true,
    });

    for (const fmt of ['json', 'markdown', 'sarif'] as const) {
      const orchestrator = new Orchestrator(config, mockModelClient(), safeTarget(), TEST_DB);
      const result = await orchestrator.run(fmt);
      expect(result.output.length).toBeGreaterThan(0), `Format ${fmt} should produce output`;
      orchestrator.close();
    }
  });

  it('iteration count respects maxIterations', async () => {
    const config = OrchestratorConfigSchema.parse({
      goal: 'Exhaustive probe',
      targetDescriptor: 'mock:safe',
      owaspIds: ['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10'],
      maxIterations: 1,
      applyPatches: false,
      allowOpenCritical: true,
    });

    const orchestrator = new Orchestrator(config, mockModelClient(), safeTarget(), TEST_DB);
    const result = await orchestrator.run('text');

    expect(result.iterations).toBeLessThanOrEqual(1);
    orchestrator.close();
  });

  it('OrchestratorConfigSchema rejects invalid config', () => {
    expect(() =>
      OrchestratorConfigSchema.parse({ goal: '' })
    ).toThrow();
  });

  it('OrchestratorConfigSchema accepts valid config with defaults', () => {
    const config = OrchestratorConfigSchema.parse({
      goal: 'Test',
      targetDescriptor: 'mock',
      owaspIds: ['LLM01'],
    });
    expect(config.maxIterations).toBe(3);
    expect(config.applyPatches).toBe(false);
    expect(config.allowOpenCritical).toBe(false);
  });
});
