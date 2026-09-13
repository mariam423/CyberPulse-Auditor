/**
 * gui/lib/db.ts
 *
 * Thin, self-contained SQLite reader for the GUI.
 *
 * COMPATIBILITY (Node 20 — the CI standard):
 *   Uses `better-sqlite3` (root dependency, native-compiled for whatever
 *   Node version `npm install` runs under) instead of `node:sqlite`
 *   which only exists on Node ≥ 22.5. Reads the shared CyberPulse
 *   database at <project root>/data/cyberpulse.db.
 *
 * All exports are re-exported from db-compat.ts — same shape, same
 * behavior, so every API route imports work unchanged.
 */

export {
  listRuns,
  getRun,
} from './db-compat';
export type {
  RunSummary,
  Finding,
  RunDetail,
} from './db-compat';
