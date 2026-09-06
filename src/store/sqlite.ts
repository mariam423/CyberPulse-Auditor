import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { z } from 'zod';
import { logger } from '../util/logger.js';
import { OwaspIdSchema, SeveritySchema } from '../owasp/types.js';
import type { RunId, FindingId, PatchId, RetestId } from '../util/ids.js';

const RunStatusSchema = z.enum(['running', 'partial', 'complete', 'error']);
type RunStatus = z.infer<typeof RunStatusSchema>;

interface RunRow {
  id: string;
  target: string;
  config_json: string;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
}

interface AttemptRow {
  id: string;
  run_id: string;
  agent: string;
  payload: string;
  response: string;
  ts: string;
}

interface FindingRow {
  id: string;
  run_id: string;
  owasp_id: string;
  severity: string;
  title: string;
  evidence: string;
  repro_json: string;
  closed: number; // 0 or 1
}

interface PatchRow {
  id: string;
  run_id: string;
  finding_id: string;
  kind: 'prompt' | 'code';
  before: string;
  after_or_diff: string;
  zod_schema: string;
  rationale: string;
}

interface RetestRow {
  id: string;
  run_id: string;
  finding_id: string;
  closed: number;
  attempts_json: string;
  evidence: string;
  ts: string;
}

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(dbPath?: string) {
    const resolved = resolve(dbPath ?? process.cwd(), 'data/cyberpulse.db');
    mkdirSync(resolve(resolved, '..'), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
    logger.info('store:sqlite', `Opened database at ${resolved}`);
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        config_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        started_at TEXT NOT NULL,
        finished_at TEXT
      );

      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        agent TEXT NOT NULL,
        payload TEXT NOT NULL,
        response TEXT NOT NULL,
        ts TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        owasp_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        evidence TEXT NOT NULL,
        repro_json TEXT NOT NULL,
        closed INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS patches (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        finding_id TEXT NOT NULL REFERENCES findings(id),
        kind TEXT NOT NULL,
        before TEXT NOT NULL,
        after_or_diff TEXT NOT NULL,
        zod_schema TEXT NOT NULL,
        rationale TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS retests (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        finding_id TEXT NOT NULL REFERENCES findings(id),
        closed INTEGER NOT NULL,
        attempts_json TEXT NOT NULL,
        evidence TEXT NOT NULL,
        ts TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_findings_run_id ON findings(run_id);
      CREATE INDEX IF NOT EXISTS idx_patches_run_id ON patches(run_id);
      CREATE INDEX IF NOT EXISTS idx_retests_run_id ON retests(run_id);
      CREATE INDEX IF NOT EXISTS idx_attempts_run_id ON attempts(run_id);
    `);
  }

  // Runs
  createRun(id: RunId, target: string, config: unknown): void {
    const stmt = this.db.prepare(
      `INSERT INTO runs (id, target, config_json, started_at) VALUES (?, ?, ?, ?)`
    );
    stmt.run(id, target, JSON.stringify(config), new Date().toISOString());
  }

  finishRun(id: RunId, status: RunStatus): void {
    const stmt = this.db.prepare(
      `UPDATE runs SET status = ?, finished_at = ? WHERE id = ?`
    );
    stmt.run(status, new Date().toISOString(), id);
  }

  getRun(id: RunId): RunRow | undefined {
    const stmt = this.db.prepare(`SELECT * FROM runs WHERE id = ?`);
    return stmt.get(id) as RunRow | undefined;
  }

  listRuns(): RunRow[] {
    const stmt = this.db.prepare(`SELECT * FROM runs ORDER BY started_at DESC`);
    return stmt.all() as RunRow[];
  }

  // Findings
  addFinding(row: {
    id: FindingId;
    runId: RunId;
    owaspId: string;
    severity: string;
    title: string;
    evidence: string;
    repro: unknown;
  }): void {
    const stmt = this.db.prepare(
      `INSERT INTO findings (id, run_id, owasp_id, severity, title, evidence, repro_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      row.id,
      row.runId,
      row.owaspId,
      row.severity,
      row.title,
      row.evidence,
      JSON.stringify(row.repro)
    );
  }

  closeFinding(id: FindingId): void {
    const stmt = this.db.prepare(`UPDATE findings SET closed = 1 WHERE id = ?`);
    stmt.run(id);
  }

  getFindingsByRun(runId: RunId): FindingRow[] {
    const stmt = this.db.prepare(`SELECT * FROM findings WHERE run_id = ?`);
    return stmt.all(runId) as FindingRow[];
  }

  getOpenFindings(runId: RunId): FindingRow[] {
    const stmt = this.db.prepare(`SELECT * FROM findings WHERE run_id = ? AND closed = 0`);
    return stmt.all(runId) as FindingRow[];
  }

  // Patches
  addPatch(row: {
    id: PatchId;
    runId: RunId;
    findingId: FindingId;
    kind: 'prompt' | 'code';
    before: string;
    afterOrDiff: string;
    zodSchema: string;
    rationale: string;
  }): void {
    const stmt = this.db.prepare(
      `INSERT INTO patches (id, run_id, finding_id, kind, before, after_or_diff, zod_schema, rationale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(row.id, row.runId, row.findingId, row.kind, row.before, row.afterOrDiff, row.zodSchema, row.rationale);
  }

  getPatchesByFinding(findingId: FindingId): PatchRow[] {
    const stmt = this.db.prepare(`SELECT * FROM patches WHERE finding_id = ?`);
    return stmt.all(findingId) as PatchRow[];
  }

  // Retests
  addRetest(row: {
    id: RetestId;
    runId: RunId;
    findingId: FindingId;
    closed: boolean;
    attempts: unknown[];
    evidence: string;
  }): void {
    const stmt = this.db.prepare(
      `INSERT INTO retests (id, run_id, finding_id, closed, attempts_json, evidence, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      row.id,
      row.runId,
      row.findingId,
      row.closed ? 1 : 0,
      JSON.stringify(row.attempts),
      row.evidence,
      new Date().toISOString()
    );
  }

  // Attempts
  addAttempt(row: {
    id: string;
    runId: RunId;
    agent: string;
    payload: string;
    response: string;
  }): void {
    const stmt = this.db.prepare(
      `INSERT INTO attempts (id, run_id, agent, payload, response, ts)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(row.id, row.runId, row.agent, row.payload, row.response, new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}
