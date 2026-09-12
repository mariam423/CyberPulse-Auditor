/**
 * Agent Interop Layer — Copaw ↔ OpenClaude ↔ Hermes
 * ─────────────────────────────────────────────────
 * Translates tasks and results between agent environments using a single
 * unified envelope format. Every agent consumes the same provider config
 * and the same credential handle — no per-agent key copies.
 *
 * ISOLATION: no imports from ../../src/** — the CyberPulse core is untouched.
 */

import { z } from 'zod';
import { resolveProviderConfig, checkCredential, redactedConfigView } from '../config/provider.js';
import type { ProviderConfig } from '../config/provider.js';

/** Agent identifiers participating in the mesh. */
export const AGENTS = ['copaw', 'openclaude', 'hermes', 'pi'] as const;
export type AgentName = (typeof AGENTS)[number];

/** Capabilities each agent advertises (mirrors .copaw/workspace.json). */
export const AGENT_CAPABILITIES: Record<AgentName, readonly string[]> = {
  copaw: ['orchestrate', 'verify', 'regression', 'retest', 'route'],
  openclaude: ['analyze', 'classify', 'triage', 'report', 'owasp'],
  hermes: ['patch-generate', 'patch-review', 'patch-apply', 'rollback'],
  pi: ['refactor', 'code-review', 'scaffold', 'modernize'],
};

/** Unified envelope every agent speaks. */
export const TaskEnvelopeSchema = z.object({
  id: z.string().min(1),
  from: z.enum(AGENTS),
  to: z.enum(AGENTS),
  capability: z.string().min(1),
  prompt: z.string().min(1),
  createdAt: z.string().default(() => new Date().toISOString()),
  /** Sensitive payloads travel as references, never inline credentials. */
  metadata: z.record(z.unknown()).optional(),
});
export type TaskEnvelope = z.infer<typeof TaskEnvelopeSchema>;

export const TaskResultSchema = z.object({
  id: z.string(),
  from: z.enum(AGENTS),
  to: z.enum(AGENTS),
  ok: z.boolean(),
  output: z.string(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative().default(0),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

/** Router: capability + regex task-delegation rules from the workspace config. */
const DELEGATION_RULES: Array<{ match: RegExp; agent: AgentName }> = [
  { match: /audit|analyze|classify|owasp|triage/i, agent: 'openclaude' },
  { match: /patch|fix|harden|remediat|rollback/i, agent: 'hermes' },
  { match: /refactor|modernize|scaffold|code-review/i, agent: 'pi' },
  { match: /verify|test|regression|retest/i, agent: 'copaw' },
];

/** Route a task to the correct agent by capability or textual intent. */
export function routeTask(prompt: string, capability?: string): AgentName {
  if (capability) {
    for (const name of AGENTS) {
      if (AGENT_CAPABILITIES[name].includes(capability)) return name;
    }
  }
  for (const rule of DELEGATION_RULES) {
    if (rule.match.test(prompt)) return rule.agent;
  }
  return 'copaw'; // fallback — primary orchestrator
}

/** Canonical role per agent (mirrors .copaw/workspace.json). */
export const AGENT_ROLES: Record<AgentName, string> = {
  copaw: 'primary-orchestrator',
  openclaude: 'security-analyst',
  hermes: 'patch-engineer',
  pi: 'refactor-engineer',
};

/**
 * Create a validated task envelope for delegation.
 * Credentials are NEVER embedded — the receiving agent resolves keys itself
 * from the environment via the shared provider config.
 */
export function createTask(from: AgentName, prompt: string, opts?: { to?: AgentName; capability?: string }): TaskEnvelope {
  const to = opts?.to ?? routeTask(prompt, opts?.capability);
  return TaskEnvelopeSchema.parse({
    id: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    capability: opts?.capability ?? 'route',
    prompt,
  });
}

export interface AgentRuntime {
  name: AgentName;
  config: ProviderConfig;
  credential: { resolved: boolean; missingFrom: string[] };
  /** Safe, redacted view for status endpoints and logs. */
  describe(): Record<string, unknown>;
  /** Execute a task envelope — returns the result without ever logging secrets. */
  execute(task: TaskEnvelope): Promise<TaskResult>;
}

/**
 * Base runtime shared by all agents: same provider, same credential handle,
 * redaction enforced on every describe() output.
 */
export function createAgentRuntime(name: AgentName): AgentRuntime {
  const config = resolveProviderConfig();
  const credential = checkCredential();

  return {
    name,
    config,
    credential,
    describe() {
      return {
        agent: name,
        role: AGENT_ROLES[name],
        capabilities: AGENT_CAPABILITIES[name],
        provider: redactedConfigView(config),
        credential: credential.resolved ? '«env-resolved»' : `«missing: ${credential.missingFrom.join(', ')}»`,
      };
    },
    async execute(task) {
      const started = Date.now();
      if (task.to !== name) {
        return {
          id: task.id,
          from: task.from,
          to: task.to,
          ok: false,
          output: '',
          error: `Envelope addressed to '${task.to}' but runtime is '${name}'`,
          durationMs: Date.now() - started,
        };
      }
      // Local echo execution — proves the full envelope → route → execute →
      // result loop without hitting a real model API or exposing credentials.
      return {
        id: task.id,
        from: task.from,
        to: name,
        ok: true,
        output: `[${name}] acknowledged task ${task.id} (capability: ${task.capability})`,
        durationMs: Date.now() - started,
      };
    },
  };
}
