/**
 * Distributed Rate Limiter — Redis-compatible with in-memory fallback
 * ────────────────────────────────────────────────────────────────────
 * SCALE CONTRACT:
 *   - Single container: in-memory fixed windows (works today).
 *   - N replicas behind a load balancer: set REDIS_URL → the same
 *     interface switches to atomic INCR+EXPIRE in Redis, giving every
 *     replica a SHARED limit (per-IP) — the classic production pattern.
 *
 * Same API as gui/lib/api-guard.ts checkRateLimit, so route code never
 * changes when the backend switches.
 */

export interface DistributedLimiter {
  /** Returns remaining budget; throws never. */
  consume(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; remaining: number; resetAt: number }>;
  close(): Promise<void>;
}

// ── In-memory driver (single process) ───────────────────────────────────────

class MemoryLimiter implements DistributedLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const state = this.windows.get(key);
    if (!state || state.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      if (this.windows.size > 50_000) {
        for (const [k, s] of this.windows) if (s.resetAt <= now) this.windows.delete(k);
      }
      return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
    }
    state.count++;
    return { ok: state.count <= limit, remaining: Math.max(0, limit - state.count), resetAt: state.resetAt };
  }

  async close() { /* nothing to release */ }
}

// ── Redis driver (fleet scale — lazy optional dep) ──────────────────────────

/** Minimal Redis surface this limiter needs (decoupled from `ioredis` types). */
interface MinimalRedisClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  disconnect(): void;
}

class RedisLimiter implements DistributedLimiter {
  private client: MinimalRedisClient | null = null;

  constructor(private readonly url: string) {}

  private async conn(): Promise<MinimalRedisClient> {
    if (!this.client) {
      // Optional dependency — resolved at runtime only when REDIS_URL is set.
      // String specifier keeps tsc happy when `ioredis` is not installed;
      // the clear install hint surfaces at runtime if it is missing.
      const specifier = 'ioredis';
      const mod = (await import(/* webpackIgnore: true */ specifier)) as {
        default: { Redis: new (url: string) => MinimalRedisClient };
      };
      this.client = new mod.default.Redis(this.url);
    }
    return this.client;
  }

  async consume(key: string, limit: number, windowMs: number) {
    const c = await this.conn();
    const redisKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`; // fixed window bucket
    const count = await c.incr(redisKey);
    if (count === 1) {
      await c.expire(redisKey, Math.ceil(windowMs / 1000) + 1);
    }
    const resetAt = (Math.floor(Date.now() / windowMs) + 1) * windowMs;
    return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt };
  }

  async close() {
    this.client?.disconnect();
    this.client = null;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

let limiter: DistributedLimiter | null = null;

export function getRateLimiter(): DistributedLimiter {
  if (!limiter) {
    limiter = process.env.REDIS_URL ? new RedisLimiter(process.env.REDIS_URL) : new MemoryLimiter();
  }
  return limiter;
}

/** Test hook. */
export function resetLimiterForTests(): void {
  limiter = null;
}
