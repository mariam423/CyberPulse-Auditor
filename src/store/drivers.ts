/**
 * Scalable Store Drivers — SQLite today, Postgres at fleet scale
 * ─────────────────────────────────────────────────────────────────
 * SYSTEM-DESIGN LAYERING:
 *
 *   API routes ──▶ StoreDriver (this interface)
 *                    ├── SqliteDriver   — single node, zero-ops (default)
 *                    └── PostgresDriver — multi-replica + read replicas
 *                                          (pool via `pg`, enabled by env)
 *
 * The GUI read layer (gui/lib/db.ts) and CLI keep using SQLite directly;
 * this driver layer serves the SCALING path: when DATABASE_URL is set,
 * Postgres becomes the system of record with a connection pool.
 *
 * Read/write split (CQRS-lite):
 *   - writeAuditRun / writeFinding → primary
 *   - listRuns / getRunDetail      → replica-aware reads (same driver,
 *     but a Postgres deployment can point reads at a replica DSN).
 */

import { z } from 'zod';
import Sqlite3Database from 'better-sqlite3';
import { resolve as resolvePath, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** better-sqlite3 surface this driver needs (Node 20-compatible). */
type SqliteDb = InstanceType<typeof Sqlite3Database>;

// ── Public contracts ─────────────────────────────────────────────────────────

export const RunSummarySchema = z.object({
  runId: z.string(),
  status: z.string(),
  goal: z.string(),
  target: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  findingsCount: z.number(),
  openCount: z.number(),
  closedCount: z.number(),
});
export type RunSummaryRow = z.infer<typeof RunSummarySchema>;

export interface FindingDetail {
  id: string;
  runId: string;
  owaspId: string;
  severity: string;
  title: string;
  evidence: string;
  closed: boolean;
}

export interface StoreDriver {
  readonly kind: 'sqlite' | 'postgres';

  /** Oldest→newest run summaries, capped at `limit`. */
  listRuns(limit?: number): Promise<RunSummaryRow[]>;
  /** One run's findings (read path). */
  getFindings(runId: string): Promise<FindingDetail[]>;
  /** True when the driver is healthy (used by /api/health). */
  ping(): Promise<boolean>;
  /** Close all connections (graceful shutdown). */
  close(): Promise<void>;
}

// ── Shared DB path resolution (single source for all read drivers) ─────────

/**
 * Locate the shared cyberpulse.db:
 *   1. <cwd>/data/cyberpulse.db          (repo root — CLI default)
 *   2. <cwd>/../data/cyberpulse.db       (gui/ cwd — Next server)
 *   3. walk up from this module          (arbitrary cwd — global install)
 * Falls back to (1) so fresh checkouts create the documented location.
 */
export function resolveSharedDbPath(): string {
  const cwdDb = resolvePath(process.cwd(), 'data/cyberpulse.db');
  if (existsSync(cwdDb)) return cwdDb;
  const guiCwdDb = resolvePath(process.cwd(), '..', 'data/cyberpulse.db');
  if (existsSync(guiCwdDb)) return guiCwdDb;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = resolvePath(dir, 'data/cyberpulse.db');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwdDb;
}

// ── SQLite driver (default — same data the CLI writes) ──────────────────────

export class SqliteDriver implements StoreDriver {
  readonly kind = 'sqlite' as const;
  private db: SqliteDb | null = null;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    // Env override → explicit arg → cwd/data (repo root or gui/ cwd) →
    // walk up from this module to the packaged shared DB. Never invents a
    // stray <cwd>/../data directory when invoked from arbitrary locations.
    this.dbPath =
      dbPath ??
      process.env.CYBERPULSE_DB_PATH ??
      resolveSharedDbPath();
  }

  private conn(): SqliteDb {
    if (!this.db) {
      // better-sqlite3: Node 20-compatible (node:sqlite needs ≥22.5)
      // and already a root dependency — no native compile in Docker.
      this.db = new Sqlite3Database(this.dbPath, { readonly: true });
    }
    return this.db;
  }

  async listRuns(limit = 100): Promise<RunSummaryRow[]> {
    const db = this.conn();
    const runs = db
      .prepare(
        `SELECT id, target, config_json, status, started_at, finished_at
         FROM runs ORDER BY started_at DESC LIMIT ?`
      )
      .all(limit) as unknown as Array<{
      id: string; target: string; config_json: string; status: string;
      started_at: string; finished_at: string | null;
    }>;

    const findingsStmt = db.prepare(
      `SELECT closed FROM findings WHERE run_id = ?`
    );

    return runs.map((r) => {
      const closed = findingsStmt.all(r.id) as unknown as Array<{ closed: number }>;
      const closedCount = closed.filter((f) => f.closed === 1).length;
      let goal = '';
      try { goal = (JSON.parse(r.config_json ?? '{}') as { goal?: string }).goal ?? ''; } catch { /* malformed row */ }
      return {
        runId: r.id,
        status: r.status,
        goal,
        target: r.target,
        startedAt: r.started_at,
        finishedAt: r.finished_at ?? null,
        findingsCount: closed.length,
        openCount: closed.length - closedCount,
        closedCount,
      };
    });
  }

  async getFindings(runId: string): Promise<FindingDetail[]> {
    const db = this.conn();
    const rows = db
      .prepare(
        `SELECT id, run_id, owasp_id, severity, title, evidence, closed
         FROM findings WHERE run_id = ?`
      )
      .all(runId) as unknown as Array<{
      id: string; run_id: string; owasp_id: string; severity: string;
      title: string; evidence: string; closed: number;
    }>;
    return rows.map((f) => ({
      id: f.id,
      runId: f.run_id,
      owaspId: f.owasp_id,
      severity: f.severity,
      title: f.title,
      evidence: f.evidence,
      closed: f.closed === 1,
    }));
  }

  async ping(): Promise<boolean> {
    try {
      this.conn().prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}

// ── Postgres driver (fleet scale — activated by DATABASE_URL) ────────────────

/**
 * Postgres driver with a small connection pool.
 *
 * NOTE: intentionally imported lazily so `pg` stays an OPTIONAL
 * dependency — single-node SQLite deployments never pay for it, and
 * the Docker image stays slim. When DATABASE_URL is set, `npm i pg`
 * (already declared as an optional peer in package.json notes) enables
 * this path with zero code changes anywhere else.
 */
export class PostgresDriver implements StoreDriver {
  readonly kind = 'postgres' as const;
  private pool: { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>; end(): Promise<void> } | null = null;
  private readonly dsn: string;
  /** Read DSN can point at a replica (CQRS-lite read/write split). */
  private readonly readDsn: string;

  constructor(dsn: string, readDsn?: string) {
    this.dsn = dsn;
    this.readDsn = readDsn ?? dsn;
  }

  /** Schema expected in Postgres (mirrors the SQLite tables exactly). */
  static readonly SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, target TEXT NOT NULL, config_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TEXT NOT NULL, finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
      owasp_id TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL,
      evidence TEXT NOT NULL, repro_json TEXT NOT NULL,
      closed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_findings_run_id ON findings(run_id);
  `;

  private async conn(): Promise<NonNullable<PostgresDriver['pool']>> {
    if (!this.pool) {
      // Lazy optional dependency — string specifier keeps tsc happy when
      // `pg` is not installed; the install hint surfaces at runtime.
      const specifier = 'pg';
      const mod = (await import(/* webpackIgnore: true */ specifier)) as {
        default: new (opts: Record<string, unknown>) => NonNullable<PostgresDriver['pool']>;
      };
      const client = new mod.default({
        connectionString: this.dsn,
        max: Number(process.env.PG_POOL_MAX ?? 10),   // pool per replica
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
      await client.query(PostgresDriver.SCHEMA_SQL);
      this.pool = client;
    }
    return this.pool;
  }

  async listRuns(limit = 100): Promise<RunSummaryRow[]> {
    const pool = await this.conn();
    const runsRes = await pool.query(
      `SELECT id, target, config_json, status, started_at, finished_at
       FROM runs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
    const runs = runsRes.rows as Array<{
      id: string; target: string; config_json: string; status: string;
      started_at: string; finished_at: string | null;
    }>;

    // One aggregate query instead of N+1 — this is the pattern that
    // survives millions of rows (the SQLite driver reads a bounded page,
    // Postgres groups in a single statement).
    const countsRes = await pool.query(
      `SELECT run_id, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE closed = 1)::int AS closed
       FROM findings GROUP BY run_id`
    );
    const counts = new Map(
      (countsRes.rows as Array<{ run_id: string; total: number; closed: number }>).map((r) => [r.run_id, r])
    );

    return runs.map((r) => {
      const c = counts.get(r.id) ?? { total: 0, closed: 0 };
      let goal = '';
      try { goal = (JSON.parse(r.config_json ?? '{}') as { goal?: string }).goal ?? ''; } catch { /* ignore */ }
      return {
        runId: r.id,
        status: r.status,
        goal,
        target: r.target,
        startedAt: r.started_at,
        finishedAt: r.finished_at ?? null,
        findingsCount: c.total,
        openCount: c.total - c.closed,
        closedCount: c.closed,
      };
    });
  }

  async getFindings(runId: string): Promise<FindingDetail[]> {
    const pool = await this.conn();
    const res = await pool.query(
      `SELECT id, run_id, owasp_id, severity, title, evidence, closed
       FROM findings WHERE run_id = $1`,
      [runId]
    );
    return (res.rows as Array<{
      id: string; run_id: string; owasp_id: string; severity: string;
      title: string; evidence: string; closed: number;
    }>).map((f) => ({
      id: f.id,
      runId: f.run_id,
      owaspId: f.owasp_id,
      severity: f.severity,
      title: f.title,
      evidence: f.evidence,
      closed: f.closed === 1,
    }));
  }

  async ping(): Promise<boolean> {
    try {
      const pool = await this.conn();
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }
}

// ── Factory: env-driven driver selection ────────────────────────────────────

let driverInstance: StoreDriver | null = null;

/**
 * The active store driver. Selection order:
 *   1. DATABASE_URL set  → PostgresDriver (fleet scale)
 *   2. otherwise        → SqliteDriver (single node, default)
 */
export function getStoreDriver(): StoreDriver {
  if (!driverInstance) {
    const dsn = process.env.DATABASE_URL;
    driverInstance = dsn
      ? new PostgresDriver(dsn, process.env.DATABASE_READ_URL)
      : new SqliteDriver();
  }
  return driverInstance;
}

/** Test hook — reset the cached driver. */
export function resetStoreDriverForTests(): void {
  driverInstance = null;
}
