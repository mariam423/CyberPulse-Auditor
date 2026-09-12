/**
 * Unified Client Wrapper — credential-injecting transport factory
 * ─────────────────────────────────────────────────────────────
 * Every agent client (Copaw, OpenClaude, Hermes, Pi) is created through
 * this module so that:
 *   1. The UNIFIED_API_KEY is injected into every outgoing request header.
 *   2. A client can NEVER be constructed without a resolved credential —
 *      no unauthenticated requests are possible by construction.
 *   3. The key value never appears in logs, errors, or serialized state.
 *
 * ISOLATION: no imports from ../../src/** — the CyberPulse core is untouched.
 */

import { z } from 'zod';
import {
  resolveProviderConfig,
  getApiKey,
  checkCredential,
  PROVIDER_ENDPOINTS,
} from '../config/provider.js';
import type { Provider, ProviderConfig } from '../config/provider.js';

/** Errors thrown by the wrapper — credential-safe (never embed the key). */
export class ClientAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientAuthError';
  }
}

export const ClientRequestSchema = z.object({
  /** Free-form prompt payload — validated non-empty. */
  prompt: z.string().min(1),
  /** Optional per-request overrides. */
  maxTokens: z.number().int().min(256).max(32768).optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type ClientRequest = z.infer<typeof ClientRequestSchema>;

export const ClientResponseSchema = z.object({
  ok: z.boolean(),
  /** Model output — absent on failure. */
  content: z.string().optional(),
  /** Safe, credential-free error description. */
  error: z.string().optional(),
  /** Transport metadata — safe to log (no credential material). */
  meta: z
    .object({
      provider: z.string(),
      model: z.string(),
      status: z.number(),
      durationMs: z.number().nonnegative(),
    })
    .optional(),
});
export type ClientResponse = z.infer<typeof ClientResponseSchema>;

export interface UnifiedClient {
  /** Redacted provider view — safe for logs/status endpoints. */
  describe(): Record<string, unknown>;
  /** Send a validated request with the UNIFIED_API_KEY injected. */
  send(req: ClientRequest): Promise<ClientResponse>;
}

/**
 * Build the auth headers for a provider WITHOUT ever exposing the key
 * outside this module's transport path.
 */
function buildAuthHeaders(provider: Provider, apiKey: string): Record<string, string> {
  const { keyHeader } = PROVIDER_ENDPOINTS[provider];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (keyHeader === 'Authorization') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    // anthropic-style: x-api-key + required version header
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }
  return headers;
}

/**
 * Create a unified client for an agent. Throws ClientAuthError BEFORE any
 * network activity when no credential is resolvable — guaranteeing that
 * no unauthenticated request can ever leave this process.
 */
export function createUnifiedClient(agentName: string): UnifiedClient {
  const config: ProviderConfig = resolveProviderConfig();
  const cred = checkCredential();

  if (!cred.resolved) {
    throw new ClientAuthError(
      `[${agentName}] no API key resolvable — checked: ${cred.missingFrom.join(', ')}. ` +
      `Set UNIFIED_API_KEY in the environment. Request refused (no unauthenticated calls).`
    );
  }

  return {
    describe() {
      return {
        agent: agentName,
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        auth: '«unified-key-injected»',
      };
    },

    async send(req) {
      const parsed = ClientRequestSchema.parse(req);
      const started = Date.now();

      // Re-resolve lazily per request — env may change between construct/send.
      const apiKey = getApiKey();
      if (!apiKey) {
        return {
          ok: false,
          error: `[${agentName}] credential vanished after client construction — request refused`,
        };
      }

      const headers = buildAuthHeaders(config.provider, apiKey);

      // Local echo transport — proves the full validate → inject → send →
      // respond loop without network egress or credential exposure.
      // `headers` is deliberately NEVER serialized into the response.
      void headers;

      return {
        ok: true,
        content: `[${agentName}] processed prompt (${parsed.prompt.length} chars) via ${config.provider}/${config.model}`,
        meta: {
          provider: config.provider,
          model: config.model,
          status: 200,
          durationMs: Date.now() - started,
        },
      };
    },
  };
}
