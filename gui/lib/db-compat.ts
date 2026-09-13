/**
 * Node-compatible SQLite readers for the GUI layer
 * ──────────────────────────────────────────────────
 * node:sqlite (DatabaseSync) exists only on Node ≥ 22.5 — the project
 * standardizes on Node 20 (LTS) per the CI contract, so all GUI read
 * paths use `better-sqlite3` (already a root dependency, compiled for
 * the running Node version by `npm ci`/`npm install`).
 *
 * This module provides the SAME read surface gui/lib/db.ts exposed
 * (listRuns / getRun), but through a driver that works on Node 20.
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';

export interface RunSummary {
  runId: string;
  status: string;
  goal: string;
  target: string;
  startedAt: string;
  finishedAt: string | null;
  findingsCount: number;
  openCount: number;
  closedCount: number;
}

export interface Finding {
  id: string;
  owaspId: string;
  severity: string;
  title: string;
  evidence: string;
  repro: { payload: string; target: string; expected: string };
  closed: boolean;
}

export interface RunDetail {
  runId: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  target: string;
  goal: string;
  iterations: number;
  findings: Finding[];
}

function getDbPath(): string {
  // The Next.js server runs with cwd = gui/, so the shared DB lives at
  // <project root>/data/cyberpulse.db → ../data/cyberpulse.db from here.
  if (process.env.CYBERPULSE_DB_PATH) return resolve(process.env.CYBERPULSE_DB_PATH);
  return resolve(process.cwd(), '..', 'data', 'cyberpulse.db');
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    // readOnly: the GUI never writes through this path — the audit engine
    // (CLI workers / queue runners) owns all writes.
    _db = new Database(getDbPath(), { readonly: true });
  }
  return _db;
}

interface RunRow {
  id: string;
  target: string;
  config_json: string;
  status: string;
  started_at: string;
  finished_at: string | null;
}

interface ClosedRow {
  id: string;
  closed: number;
}

interface FindingRow {
  id: string;
  owasp_id: string;
  severity: string;
  title: string;
  evidence: string;
  repro_json: string;
  closed: number;
}

export function listRuns(): RunSummary[] {
  const db = getDb();
  const runs = db
    .prepare(
      `SELECT id, target, config_json, status, started_at, finished_at FROM runs ORDER BY started_at DESC`
    )
    .all() as unknown as RunRow[];

  const findingsStmt = db.prepare(`SELECT id, closed FROM findings WHERE run_id = ?`);

  return runs.map((r) => {
    const config = JSON.parse(r.config_json ?? '{}') as { goal?: string };
    const findings = findingsStmt.all(r.id) as unknown as ClosedRow[];
    return {
      runId: r.id,
      status: r.status,
      goal: config.goal ?? '',
      target: r.target,
      startedAt: r.started_at,
      finishedAt: r.finished_at ?? null,
      findingsCount: findings.length,
      openCount: findings.filter((f) => f.closed === 0).length,
      closedCount: findings.filter((f) => f.closed === 1).length,
    };
  });
}

export function getRun(runId: string): RunDetail | null {
  const db = getDb();
  const run = db
    .prepare(
      `SELECT id, target, config_json, status, started_at, finished_at FROM runs WHERE id = ?`
    )
    .get(runId) as unknown as RunRow | undefined;

  if (!run) return null;

  const config = JSON.parse(run.config_json ?? '{}') as { goal?: string; maxIterations?: number };
  const rows = db
    .prepare(
      `SELECT id, owasp_id, severity, title, evidence, repro_json, closed FROM findings WHERE run_id = ?`
    )
    .all(runId) as unknown as FindingRow[];

  return {
    runId: run.id,
    status: run.status,
    startedAt: run.started_at,
    finishedAt: run.finished_at ?? new Date().toISOString(),
    target: run.target,
    goal: config.goal ?? '',
    iterations: config.maxIterations ?? 1,
    findings: rows.map((f) => ({
      id: f.id,
      owaspId: f.owasp_id,
      severity: f.severity,
      title: f.title,
      evidence: f.evidence,
      repro: JSON.parse(f.repro_json),
      closed: f.closed === 1,
    })),
  };
}
