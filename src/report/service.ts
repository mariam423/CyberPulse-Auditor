/**
 * Unified Report Service
 *
 * The single source of truth for building RunReport objects from the shared
 * SQLite store and rendering them in every supported format. Both the CLI
 * (audit / report / retest commands) and the GUI API routes (/api/report,
 * /api/runs/[id]/sarif) consume this module, guaranteeing byte-identical
 * telemetry, vulnerability classifications, and auto-patch details across
 * HTML, Markdown, JSON, Text, and SARIF 2.1.0.
 */

import { SqliteStore } from '../store/sqlite.js';
import { asRunId } from '../util/ids.js';
import type { RunId } from '../util/ids.js';
import { formatMarkdown } from './markdown.js';
import { formatSarif } from './sarif.js';
import { formatHtml } from './html.js';
import { formatJson } from './json.js';
import { formatTextReport } from './text.js';
import type { RunReport, PatchReport, RetestReport } from './types.js';

export const REPORT_FORMATS = ['json', 'markdown', 'sarif', 'html', 'text'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

/** MIME types + filename extensions for downloadable reports. */
export const FORMAT_META: Record<ReportFormat, { contentType: string; ext: string }> = {
  json: { contentType: 'application/json; charset=utf-8', ext: 'json' },
  markdown: { contentType: 'text/markdown; charset=utf-8', ext: 'md' },
  sarif: { contentType: 'application/sarif+json; charset=utf-8', ext: 'sarif' },
  html: { contentType: 'text/html; charset=utf-8', ext: 'html' },
  text: { contentType: 'text/plain; charset=utf-8', ext: 'txt' },
};

/**
 * Build the complete RunReport (findings + patches + retests) from the store.
 * This is the canonical reconstruction used by BOTH CLI and GUI, replacing
 * the previous divergence where the CLI report command emitted empty
 * patches/retests arrays.
 */
export function buildRunReport(runId: string, dbPath?: string): RunReport | null {
  const store = new SqliteStore(dbPath);
  try {
    const run = store.getRun(asRunId(runId));
    if (!run) return null;

    const findings = store.getFindingsByRun(asRunId(runId));
    const patchRows = store.getPatchesByRun(asRunId(runId));
    const retestRows = store.getRetestsByRun(asRunId(runId));

    const config = JSON.parse(run.config_json ?? '{}') as {
      goal?: string;
      maxIterations?: number;
      applyPatches?: boolean;
    };

    const patches: PatchReport[] = patchRows.map((p) => ({
      id: p.id,
      findingId: p.finding_id,
      owaspId: patchOwaspId(p, findings),
      kind: p.kind,
      rationale: p.rationale,
      requiresRestart: p.kind === 'code',
      applied: Boolean(config.applyPatches),
    }));

    const retests: RetestReport[] = retestRows.map((r) => {
      const attempts = safeParseArray(r.attempts_json);
      return {
        findingId: r.finding_id,
        verdict: r.closed === 1 ? 'closed' : 'open',
        attemptsCount: attempts.length,
        evidence: r.evidence,
      };
    });

    return {
      runId: run.id as RunId,
      status: run.status as RunReport['status'],
      startedAt: run.started_at,
      finishedAt: run.finished_at ?? new Date().toISOString(),
      target: run.target,
      goal: config.goal ?? '',
      iterations: config.maxIterations ?? 1,
      findings: findings.map((f) => ({
        id: f.id,
        owaspId: f.owasp_id,
        severity: f.severity as RunReport['findings'][number]['severity'],
        title: f.title,
        evidence: f.evidence,
        repro: JSON.parse(f.repro_json) as RunReport['findings'][number]['repro'],
        closed: f.closed === 1,
      })),
      patches,
      retests,
    };
  } finally {
    store.close();
  }
}

/** Resolve a patch's OWASP id via its parent finding (patches table has no owasp column). */
function patchOwaspId(
  patch: { finding_id: string },
  findings: Array<{ id: string; owasp_id: string }>
): string {
  return findings.find((f) => f.id === patch.finding_id)?.owasp_id ?? 'LLM01';
}

function safeParseArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Render a RunReport in the requested format — identical output for CLI and GUI.
 */
export function renderReport(report: RunReport, format: ReportFormat): string {
  switch (format) {
    case 'markdown':
      return formatMarkdown(report);
    case 'sarif':
      return JSON.stringify(formatSarif(report), null, 2);
    case 'html':
      return formatHtml(report);
    case 'json':
      return formatJson(report);
    case 'text':
    default:
      return formatTextReport(report);
  }
}

/**
 * Build + render in one step from the shared database.
 */
export function generateReport(
  runId: string,
  format: ReportFormat,
  dbPath?: string
): { content: string } | { error: 'not_found' } {
  const report = buildRunReport(runId, dbPath);
  if (!report) return { error: 'not_found' };
  return { content: renderReport(report, format) };
}

/** Canonical download filename for a run's report. */
export function reportFilename(runId: string, format: ReportFormat): string {
  return `cyberpulse-${runId}.${FORMAT_META[format].ext}`;
}
