/**
 * SaaS API Guardrails — rate limiting + input sanitization helpers
 * ─────────────────────────────────────────────────────────────────
 * Shared utilities for every GUI API route:
 *   - `withRateLimit`  : fixed-window in-memory rate limiter (per IP+route)
 *   - `parseJsonBody`  : Zod-validated JSON body parsing with size caps
 *   - `jsonError`      : consistent, safe error responses (never leaks stack)
 *
 * The limiter is per-process (sufficient for the single-container
 * deployment; a Redis backend can slot in later behind the same interface).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ── Rate limiting ────────────────────────────────────────────────────────────

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();

/** Occasionally sweep expired windows so the map never grows unbounded. */
function sweep(now: number): void {
  if (windows.size < 10_000) return;
  for (const [key, state] of windows) {
    if (state.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitOptions {
  /** Max requests per window (default: env or 30). */
  max?: number;
  /** Window length in ms (default: env or 60s). */
  windowMs?: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/** Fixed-window limiter keyed by client IP + route label. */
export function checkRateLimit(
  req: NextRequest,
  routeKey: string,
  opts: RateLimitOptions = {}
): RateLimitResult {
  const limit = opts.max ?? Number(process.env.RATE_LIMIT_MAX ?? 30);
  const windowMs = opts.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'local';

  const key = `${routeKey}:${ip}`;
  const now = Date.now();

  const state = windows.get(key);
  if (!state || state.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    sweep(now);
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs, limit };
  }

  state.count++;
  return {
    ok: state.count <= limit,
    remaining: Math.max(0, limit - state.count),
    resetAt: state.resetAt,
    limit,
  };
}

/** 429 response with standard rate-limit headers. */
export function rateLimitResponse(rl: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Rate limit exceeded — slow down.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
        'X-RateLimit-Limit': String(rl.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
      },
    }
  );
}

/**
 * Wrap an API handler with rate limiting.
 * Usage:
 *   export const GET = withRateLimit('runs', () => { ... })
 */
export function withRateLimit<Ctx = unknown>(
  routeKey: string,
  handler: (req: NextRequest, ctx: Ctx) => Promise<NextResponse> | NextResponse,
  opts?: RateLimitOptions
) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    const rl = checkRateLimit(req, routeKey, opts);
    if (!rl.ok) return rateLimitResponse(rl);
    const res = await handler(req, ctx);
    res.headers.set('X-RateLimit-Limit', String(rl.limit));
    res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return res;
  };
}

// ── Body parsing + validation ────────────────────────────────────────────────

/** Hard cap on request body size (512 KB) — rejects oversized payloads early. */
const MAX_BODY_BYTES = 512 * 1024;

export class BodyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BodyValidationError';
  }
}

/**
 * Read + parse + Zod-validate a JSON request body.
 * Throws BodyValidationError on: oversized payload, malformed JSON, or
 * schema violations — with safe messages (no internals leaked).
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S
): Promise<z.infer<S>> {
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new BodyValidationError('Request body too large (max 512 KB).');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new BodyValidationError('Request body must be valid JSON.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.errors
      .slice(0, 5)
      .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('; ');
    throw new BodyValidationError(`Validation failed: ${issues}`);
  }
  return parsed.data as z.infer<S>;
}

/** Consistent safe error response — never exposes stack traces or internals. */
export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Route-parameter sanitizer: hex-id pattern used by CyberPulse run ids. */
export const RunIdParamSchema = z
  .string()
  .regex(/^run_[a-f0-9]{8,64}$/i, 'Invalid run id format');

/** Finding/patch/retest id pattern (brand prefixes + hex). */
export const FindingIdParamSchema = z
  .string()
  .regex(/^(fnd|pat|ret)_[a-f0-9]{8,64}$/i, 'Invalid finding id format');
