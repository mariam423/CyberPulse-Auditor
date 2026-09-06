/**
 * CyberPulse Core — Audit Orchestrator
 *
 * Single-instance orchestrator backed by the existing Custom Orchestrator.
 * Exposes a clean promise-based API consumable by both CLI (direct import)
 * and GUI (via API routes).
 */
import type { AuditConfig, ScanStatus, RunReport, OwaspId } from './types.js';
import type { AuditOutputFormat } from '../orchestrator/orchestrator.js';
export type { AuditConfig, ScanStatus, RunReport, OwaspId };
/**
 * Build a ScanStatus snapshot from a running orchestrator.
 */
export declare function buildScanStatus(runId: string | null, phase: ScanStatus['phase'], progress: number, currentOwasp: OwaspId | null, iterations: number, findingsCount: number, patchesCount: number, startedAt: string | null): ScanStatus;
/**
 * Create a new audit run from config + descriptors.
 * Returns the final RunReport.
 */
export declare function runAudit(config: AuditConfig, modelDescriptor: {
    provider: 'openai' | 'anthropic' | 'ollama';
    model: string;
    apiKey?: string;
    baseUrl?: string;
}, outputFormat?: AuditOutputFormat, dbPath?: string): Promise<RunReport>;
/**
 * List all runs from the SQLite store.
 */
export declare function listRuns(dbPath?: string): Promise<Array<{
    runId: string;
    status: string;
    goal: string;
    target: string;
    startedAt: string;
    finishedAt: string | null;
    findingsCount: number;
    openCount: number;
    closedCount: number;
}>>;
/**
 * Load a single run with full findings.
 */
export declare function getRun(runId: string, dbPath?: string): Promise<RunReport | null>;
