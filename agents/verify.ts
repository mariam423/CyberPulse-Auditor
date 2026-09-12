/**
 * Agent Config Loader + Local Test Harness
 * ────────────────────────────────────────
 * Loads .copaw/workspace.json, the unified provider config, and the interop
 * mesh; verifies every agent boots with zero runtime errors; and exercises
 * the full task-delegation loop in a sandboxed, credential-safe manner.
 *
 * Usage:
 *   node --import ts-node/esm agents/verify.ts            # full self-check
 *   node --import ts-node/esm agents/verify.ts --json     # machine-readable
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { resolveProviderConfig, checkCredential, redactedConfigView, getApiKey } from './config/provider.js';
import { createAgentRuntime, createTask, routeTask, AGENTS } from './interop/mesh.js';
import { createUnifiedClient, ClientAuthError } from './interop/client.js';
import type { TaskEnvelope } from './interop/mesh.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => string | true): void {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail === true ? 'ok' : detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

async function checkAsync(name: string, fn: () => Promise<string | true>): Promise<void> {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail === true ? 'ok' : detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

// ── 1. Workspace config loads and validates ────────────────────────────────────

const WorkspaceSchema = z.object({
  version: z.string(),
  name: z.string(),
  primaryAgent: z.object({
    name: z.string(),
    role: z.string(),
    model: z.object({
      provider: z.string(),
      apiKeyEnv: z.string(),
      temperature: z.number().min(0).max(2),
    }),
  }),
  agents: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
        capabilities: z.array(z.string()),
        sandbox: z.string().optional(),
        requiresApproval: z.array(z.string()).optional(),
      })
    )
    .min(2),
  promptRouting: z.object({
    routes: z
      .array(
        z.object({
          name: z.string(),
          agent: z.string(),
          match: z.string(),
          systemPromptRef: z.string().optional(),
        })
      )
      .min(1),
  }),
  commandExecution: z.object({
    policy: z.literal('allowlist'),
    allow: z.array(z.string()).min(1),
    deny: z.array(z.string()).min(1),
  }),
  credentialHandling: z.object({
    source: z.literal('environment-only'),
    neverLog: z.literal(true),
    neverPersist: z.literal(true),
    redactInOutput: z.literal(true),
  }),
});

let workspace: z.infer<typeof WorkspaceSchema>;
let rawWorkspace: Record<string, unknown>;

check('.copaw/workspace.json loads + schema-validates', () => {
  rawWorkspace = JSON.parse(readFileSync(resolve(ROOT, '.copaw/workspace.json'), 'utf-8'));
  workspace = WorkspaceSchema.parse(rawWorkspace);
  return `${workspace.agents.length} agents, ${workspace.promptRouting.routes.length} routes, ${workspace.commandExecution.allow.length} allowed commands`;
});

// ── 2. Prompt templates referenced by the workspace exist ──────────────────────

check('prompt templates exist on disk', () => {
  const refs = new Set<string>();
  refs.add(`agents/templates/${workspace.primaryAgent.role === 'primary-orchestrator' ? 'orchestrator' : 'primary'}.md`);
  for (const route of workspace.promptRouting.routes) {
    if (route.systemPromptRef) refs.add(route.systemPromptRef);
  }
  for (const agent of workspace.agents) {
    if (agent.role === 'security-analyst') refs.add('agents/templates/security-analyst.md');
    if (agent.role === 'patch-engineer') refs.add('agents/templates/patch-engineer.md');
    if (agent.role === 'refactor-engineer') refs.add('agents/templates/refactor-engineer.md');
  }
  for (const rel of refs) {
    readFileSync(resolve(ROOT, rel), 'utf-8'); // throws if missing
  }
  return `${refs.size} templates verified: ${[...refs].join(', ')}`;
});

// ── 2b. All four agents declared in the workspace with unified credentials ──

check('workspace declares copaw, openclaude, hermes, and pi', () => {
  const names = workspace.agents.map((a) => a.name);
  for (const required of ['openclaude', 'hermes', 'pi']) {
    if (!names.includes(required)) throw new Error(`workspace.agents missing: ${required}`);
  }
  if (workspace.primaryAgent.name !== 'copaw') throw new Error('primaryAgent is not copaw');
  return `4 agents declared: copaw (primary), ${names.join(', ')}`;
});

check('workspace agents resolve credentials via UNIFIED_API_KEY', () => {
  const rawAgents = [
    (rawWorkspace['primaryAgent'] as { model?: { apiKeyEnv?: string } })?.model,
    ...((rawWorkspace['agents'] as Array<{ model?: { apiKeyEnv?: string } }>) ?? []).map((a) => a.model),
  ];
  for (const m of rawAgents) {
    const keyEnv = m?.apiKeyEnv;
    if (!keyEnv || keyEnv !== 'UNIFIED_API_KEY') {
      throw new Error(`agent model apiKeyEnv must be UNIFIED_API_KEY, got: ${String(keyEnv)}`);
    }
  }
  const order = (rawWorkspace as { credentialHandling?: { resolutionOrder?: string[] } }).credentialHandling?.resolutionOrder ?? [];
  if (order[0] !== 'UNIFIED_API_KEY') throw new Error(`credential resolutionOrder must start with UNIFIED_API_KEY, got: ${String(order[0])}`);
  return `all agent models + resolution order anchored on UNIFIED_API_KEY (${order.join(' → ')})`;
});

// ── 3. Workspace deny-list blocks dangerous commands; allow-list is sane ──────

check('command policy: deny-list blocks env/key exfiltration', () => {
  const denyJoined = workspace.commandExecution.deny.join('||');
  for (const marker of ['sudo', 'printenv', 'curl * | sh', 'npm publish']) {
    if (!denyJoined.includes(marker)) throw new Error(`deny-list missing: ${marker}`);
  }
  return 'sudo / env-dump / pipe-to-shell / publish all denied';
});

// ── 4. Unified provider config resolves ───────────────────────────────────────

let providerView = '';

check('unified provider config resolves from environment', () => {
  const cfg = resolveProviderConfig();
  providerView = JSON.stringify(redactedConfigView(cfg));
  if (cfg.model.length === 0) throw new Error('model is empty');
  if (!cfg.baseUrl.startsWith('http')) throw new Error('baseUrl is not a URL');
  return `provider=${cfg.provider} model=${cfg.model}`;
});

// ── 5. Credential handling: resolved via env, never exposed ────────────────────

check('credential: environment-only, redacted in every view', () => {
  const cred = checkCredential();
  const view = redactedConfigView(resolveProviderConfig());
  const serialized = JSON.stringify(view);
  if (serialized.includes(cred.missingFrom.join(',') === '' ? '«redacted-present»' : '«missing')) {
    // marker present — good
  }
  // The redacted view must NEVER contain a raw key value:
  for (const name of ['UNIFIED_API_KEY', 'CYBERPULSE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY']) {
    const raw = process.env[name];
    if (raw && serialized.includes(raw)) throw new Error(`LEAK: ${name} value present in redacted view`);
  }
  return cred.resolved ? 'credential resolved from env (value redacted)' : `no key in env — only presence checked (${cred.missingFrom.join(', ')})`;
});

// ── 5b. UNIFIED_API_KEY is the canonical credential and wins resolution ─────

check('UNIFIED_API_KEY takes precedence in the resolution order', () => {
  const env = { UNIFIED_API_KEY: 'unified-test-key-000', ANTHROPIC_API_KEY: 'anthropic-test-key-111' };
  const resolved = getApiKey(env);
  if (resolved !== 'unified-test-key-000') {
    throw new Error(`expected UNIFIED_API_KEY to win, got: ${resolved === 'anthropic-test-key-111' ? 'ANTHROPIC_API_KEY' : String(resolved)}`);
  }
  const fallback = getApiKey({ ANTHROPIC_API_KEY: 'anthropic-test-key-111' });
  if (fallback !== 'anthropic-test-key-111') throw new Error('fallback resolution broken');
  const none = getApiKey({});
  if (none !== null) throw new Error('empty env must resolve to null');
  return 'UNIFIED_API_KEY → CYBERPULSE_API_KEY → provider keys → null';
});

check('checkCredential reports missing sources without exposing values', () => {
  const all = checkCredential({});
  if (all.resolved) throw new Error('empty env must not resolve');
  if (all.missingFrom[0] !== 'UNIFIED_API_KEY' || all.missingFrom.length !== 5) {
    throw new Error(`unexpected missing list: ${all.missingFrom.join(', ')}`);
  }
  const partial = checkCredential({ OPENAI_API_KEY: 'k' });
  if (!partial.resolved || !partial.missingFrom.includes('UNIFIED_API_KEY')) throw new Error('partial resolution wrong');
  return 'masked handle correct — no key values cross the surface';
});

// ── 6. Agent mesh boots — every agent loads with zero runtime errors ───────────

const runtimes = new Map<string, ReturnType<typeof createAgentRuntime>>();

for (const name of AGENTS) {
  check(`agent boot: ${name}`, () => {
    const rt = createAgentRuntime(name);
    runtimes.set(name, rt);
    const d = rt.describe();
    if (d['agent'] !== name) throw new Error('describe() returned wrong agent name');
    // Credential never appears in describe output:
    const serialized = JSON.stringify(d);
    for (const envName of ['UNIFIED_API_KEY', 'CYBERPULSE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY']) {
      const raw = process.env[envName];
      if (raw && serialized.includes(raw)) throw new Error(`LEAK in describe(): ${envName}`);
    }
    return `role=${String(d['role'])} capabilities=${(d['capabilities'] as string[]).length}`;
  });
}

// ── 7. Prompt routing correctness ────────────────────────────────────────────

check('prompt routing: audit prompts → openclaude', () => {
  const target = routeTask('Run an OWASP audit on the LLM endpoint');
  if (target !== 'openclaude') throw new Error(`routed to ${target}`);
  return 'ok';
});

check('prompt routing: patch prompts → hermes', () => {
  const target = routeTask('Apply the hardening patch for the SSRF finding');
  if (target !== 'hermes') throw new Error(`routed to ${target}`);
  return 'ok';
});

check('prompt routing: verification → copaw (self)', () => {
  const target = routeTask('verify the regression suite is green');
  if (target !== 'copaw') throw new Error(`routed to ${target}`);
  return 'ok';
});

check('prompt routing: capability override wins', () => {
  const target = routeTask('anything at all', 'patch-review');
  if (target !== 'hermes') throw new Error(`routed to ${target}`);
  return 'ok';
});

check('prompt routing: refactoring prompts → pi', () => {
  const target = routeTask('Refactor the report builder and modernize its types');
  if (target !== 'pi') throw new Error(`routed to ${target}`);
  const viaCapability = routeTask('restructure this module', 'code-review');
  if (viaCapability !== 'pi') throw new Error(`capability route went to ${viaCapability}`);
  return 'intent + capability both route to pi';
});

// ── 8. Full delegation loop: envelope → route → execute → result ───────────────

await checkAsync('task delegation loop: copaw → openclaude', async () => {
  const task = createTask('copaw', 'Analyze the prompt-injection findings from run_abc', { capability: 'analyze' });
  if (task.to !== 'openclaude') throw new Error(`envelope routed to ${task.to}`);
  const rt = runtimes.get('openclaude')!;
  const result = await rt.execute(task);
  if (!result.ok) throw new Error(result.error ?? 'execute failed');
  if (!result.output.includes('openclaude')) throw new Error('result not from openclaude');
  return `${task.id} → openclaude ack in ${result.durationMs}ms`;
});

await checkAsync('task delegation loop: copaw → hermes', async () => {
  const task = createTask('copaw', 'Generate a patch for the deserialization finding', { capability: 'patch-generate' });
  if (task.to !== 'hermes') throw new Error(`envelope routed to ${task.to}`);
  const result = await runtimes.get('hermes')!.execute(task);
  if (!result.ok) throw new Error(result.error ?? 'execute failed');
  return `${task.id} → hermes ack in ${result.durationMs}ms`;
});

await checkAsync('task delegation loop: copaw → pi (refactoring)', async () => {
  const task = createTask('copaw', 'Modernize the legacy scoring helpers', { capability: 'refactor' });
  if (task.to !== 'pi') throw new Error(`envelope routed to ${task.to}`);
  const result = await runtimes.get('pi')!.execute(task);
  if (!result.ok) throw new Error(result.error ?? 'execute failed');
  if (!result.output.includes('pi')) throw new Error('result not from pi');
  return `${task.id} → pi ack in ${result.durationMs}ms`;
});

await checkAsync('mis-addressed envelope is rejected safely', async () => {
  const wrong: TaskEnvelope = {
    id: `task_misroute_${Date.now().toString(36)}`,
    from: 'copaw',
    to: 'hermes',
    capability: 'analyze',
    prompt: 'mismatched',
    createdAt: new Date().toISOString(),
  };
  const result = await runtimes.get('openclaude')!.execute(wrong);
  if (result.ok) throw new Error('mis-addressed envelope was accepted');
  if (!result.error?.includes('addressed to')) throw new Error('wrong rejection reason');
  return 'ok — refused with clear reason';
});

// ── 8b. Unified client wrapper: credential gate + leak-free transport ────────

await checkAsync('client wrapper: refuses construction without any credential', async () => {
  try {
    createUnifiedClient('copaw');
  } catch (err) {
    if (!(err instanceof ClientAuthError)) throw new Error(`expected ClientAuthError, got: ${String(err)}`);
    // unreachable when a key IS present in env — only meaningful on keyless hosts
    return 'ClientAuthError raised pre-network';
  }
  const cred = checkCredential();
  if (!cred.resolved) throw new Error('no credential but construction succeeded');
  return 'ok — construction allowed because a credential is present in env';
});

await checkAsync('client wrapper: send() is credential-safe end-to-end', async () => {
  const cred = checkCredential();
  if (!cred.resolved) return 'skipped — no credential in env';
  const client = createUnifiedClient('openclaude');
  const described = JSON.stringify(client.describe());
  const response = await client.send({ prompt: 'Summarize the LLM06 findings from the last audit' });
  const serialized = JSON.stringify(response) + described;
  for (const envName of ['UNIFIED_API_KEY', 'CYBERPULSE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY']) {
    const raw = process.env[envName];
    if (raw && serialized.includes(raw)) throw new Error(`LEAK in client transport: ${envName}`);
  }
  if (!response.ok || !response.content) throw new Error(response.error ?? 'send failed');
  return `ok — response + describe() leak-free via ${String(response.meta?.provider)}`;
});

await checkAsync('client wrapper: rejects malformed prompts without transport', async () => {
  const cred = checkCredential();
  if (!cred.resolved) return 'skipped — no credential in env';
  const client = createUnifiedClient('pi');
  try {
    await client.send({ prompt: '' });
  } catch {
    return 'ok — empty prompt rejected at the schema boundary';
  }
  throw new Error('empty prompt was accepted');
});

check('isolation: agents/ has zero imports from ../../src', () => {
  const files = ['agents/config/provider.ts', 'agents/interop/mesh.ts', 'agents/interop/client.ts'];
  for (const f of files) {
    const src = readFileSync(resolve(ROOT, f), 'utf-8');
    if (/from\s+['"](\.\.\/)+src/.test(src)) throw new Error(`${f} imports the core`);
  }
  return 'ok — agents are fully decoupled from src/';
});

// ── Report ────────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok);

if (asJson) {
  console.log(JSON.stringify({ ok: failed.length === 0, checks: results, providerView: JSON.parse(providerView || '{}') }, null, 2));
} else {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Copaw / OpenClaude / Hermes / Pi — Self-Check            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  for (const r of results) {
    console.log(`  ${r.ok ? '✔' : '✖'}  ${r.name}`);
    if (r.detail && r.detail !== 'ok') console.log(`     └─ ${r.detail}`);
  }
  console.log(`\n  ${results.length - failed.length}/${results.length} checks passed\n`);
  if (failed.length > 0) {
    console.log('  FAILED CHECKS:');
    for (const f of failed) console.log(`  ✖ ${f.name}: ${f.detail}`);
  }
}

process.exit(failed.length === 0 ? 0 : 1);
