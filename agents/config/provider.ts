/**
 * Unified API Provider Configuration
 * ──────────────────────────────────
 * Single source of truth for model-provider settings across Copaw,
 * OpenClaude, and Hermes agent environments.
 *
 * SAFETY CONTRACT
 *  - Credentials come from environment variables ONLY — never from files,
 *    configs, logs, or command lines.
 *  - Keys are resolved lazily, held in memory, and NEVER serialized,
 *    logged, or exposed through any API surface.
 *  - This module lives under agents/ and is NOT imported by src/ —
 *    complete isolation from the CyberPulse core.
 */

import { z } from 'zod';

/** Supported unified providers. */
export const ProviderSchema = z.enum(['anthropic', 'openai', 'openrouter']);
export type Provider = z.infer<typeof ProviderSchema>;

/** Resolution order — first defined env var wins. UNIFIED_API_KEY is canonical. */
const API_KEY_CANDIDATES = [
  'UNIFIED_API_KEY',
  'CYBERPULSE_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
] as const;

const BASE_URL_CANDIDATES: Record<Provider, readonly string[]> = {
  anthropic: ['CYBERPULSE_BASE_URL', 'ANTHROPIC_BASE_URL'],
  openai: ['CYBERPULSE_BASE_URL', 'OPENAI_BASE_URL'],
  openrouter: ['CYBERPULSE_BASE_URL', 'OPENROUTER_BASE_URL'],
};

/** Canonical provider endpoint mapping. */
export const PROVIDER_ENDPOINTS: Record<Provider, { defaultBaseUrl: string; keyHeader: string }> = {
  anthropic: {
    defaultBaseUrl: 'https://api.anthropic.com',
    keyHeader: 'x-api-key',
  },
  openai: {
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyHeader: 'Authorization',
  },
  openrouter: {
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyHeader: 'Authorization',
  },
};

export interface ProviderConfig {
  provider: Provider;
  model: string;
  /** Base URL — always a string, provider default when unset. */
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

export const ProviderConfigSchema = z.object({
  provider: ProviderSchema,
  model: z.string().min(1),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().int().min(256).max(32768).default(8192),
  temperature: z.number().min(0).max(2).default(0.2),
});

/**
 * Resolve a credential from env WITHOUT exposing the value.
 * Returns a masked handle: { resolved: true } or { resolved: false, missingFrom: [...] }.
 * The raw key never crosses this module's public surface except via `getApiKey()`,
 * which is internal-use only for the transport layer.
 */
export function checkCredential(env: NodeJS.ProcessEnv = process.env): {
  resolved: boolean;
  missingFrom: string[];
} {
  const missing = API_KEY_CANDIDATES.filter((name) => !env[name] || String(env[name]).trim() === '');
  return { resolved: missing.length < API_KEY_CANDIDATES.length, missingFrom: missing };
}

/**
 * INTERNAL — used only by the agent transport layer.
 * Lazily resolves the shared API key from the environment.
 */
export function getApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const name of API_KEY_CANDIDATES) {
    const raw = env[name];
    if (raw && raw.trim() !== '') return raw.trim();
  }
  return null;
}

/** Resolve the effective provider settings from the environment. */
export function resolveProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const providerEnv = (env['CYBERPULSE_PROVIDER'] ?? 'anthropic').toLowerCase();
  const provider = ProviderSchema.catch('anthropic').parse(providerEnv);

  const model =
    env['CYBERPULSE_MODEL'] ??
    (provider === 'openrouter' ? 'anthropic/claude-sonnet-4.5' : 'claude-sonnet-4-5');

  const baseUrlCandidate = BASE_URL_CANDIDATES[provider].find((name) => env[name]);
  const baseUrl = baseUrlCandidate
    ? String(env[baseUrlCandidate])
    : PROVIDER_ENDPOINTS[provider].defaultBaseUrl;

  return {
    provider,
    model,
    baseUrl,
    maxTokens: intFromEnv(env['CYBERPULSE_MAX_TOKENS'], 8192, 256, 32768),
    temperature: numFromEnv(env['CYBERPULSE_TEMPERATURE'], 0.2, 0, 2),
  };
}

/** Build a redacted view of the config — safe for logs and API responses. */
export function redactedConfigView(cfg: ProviderConfig): Record<string, unknown> {
  const cred = checkCredential();
  return {
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    apiKey: cred.resolved ? '«redacted-present»' : `«missing: ${cred.missingFrom.join(', ')}»`,
  };
}

function intFromEnv(raw: string | undefined, def: number, min: number, max: number): number {
  if (!raw) return def;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

function numFromEnv(raw: string | undefined, def: number, min: number, max: number): number {
  if (!raw) return def;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
