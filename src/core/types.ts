/**
 * CyberPulse Core — Shared Types
 *
 * All types used across CLI, GUI, and API layers.
 * Single source of truth for the domain model.
 */

import { z } from 'zod';

// ── OWASP ────────────────────────────────────────────────────────────────────

export const OwaspIdSchema = z.enum([
  'LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05',
  'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10',
]);
export type OwaspId = z.infer<typeof OwaspIdSchema>;

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

// ── Run ───────────────────────────────────────────────────────────────────────

export const RunStatusSchema = z.enum(['running', 'partial', 'complete', 'error']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

// ── Findings ─────────────────────────────────────────────────────────────────

export interface Finding {
  id: string;
  owaspId: OwaspId;
  severity: Severity;
  title: string;
  evidence: string;
  repro: {
    payload: string;
    target: string;
    expected: string;
  };
}

export interface FindingReport extends Finding {
  closed: boolean;
  closedBy?: string;
}

// ── Patches ─────────────────────────────────────────────────────────────────

export type PatchKind = 'prompt' | 'code';

export interface Patch {
  id: string;
  findingId: string;
  owaspId: OwaspId;
  kind: PatchKind;
  rationale: string;
  requiresRestart: boolean;
  applied: boolean;
  // prompt-specific
  before?: string;
  after?: string;
  // code-specific
  file?: string;
  diff?: string;
  zodSchema?: string;
}

// ── Retests ──────────────────────────────────────────────────────────────────

export type Verdict = 'closed' | 'open' | 'inconclusive';

export interface RetestAttempt {
  payload: string;
  response: string;
  passed: boolean;
}

export interface Retest {
  id: string;
  findingId: string;
  closed: boolean;
  verdict: Verdict;
  attempts: RetestAttempt[];
  evidence: string;
  timestamp: string;
}

// ── Run Report ────────────────────────────────────────────────────────────────

export interface RunReport {
  runId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string;
  target: string;
  goal: string;
  iterations: number;
  findings: FindingReport[];
  patches: Patch[];
  retests: Retest[];
}

// ── Audit Config ─────────────────────────────────────────────────────────────

export interface AuditConfig {
  goal: string;
  target: TargetDescriptor;
  owaspIds: OwaspId[];
  maxIterations: number;
  applyPatches: boolean;
  allowOpenCritical: boolean;
}

export type TargetType = 'http' | 'openai-compatible' | 'python-fn';

export interface TargetDescriptor {
  type: TargetType;
  url?: string;
  pythonFn?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ModelDescriptor {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

// ── Scan Status (for GUI real-time) ────────────────────────────────────────

export type ScanPhase =
  | 'idle'
  | 'initializing'
  | 'recon'
  | 'attack'
  | 'classify'
  | 'remediate'
  | 'retest'
  | 'complete'
  | 'error';

export interface ScanStatus {
  runId: string | null;
  phase: ScanPhase;
  progress: number; // 0–100
  currentOwasp: OwaspId | null;
  iterations: number;
  findingsCount: number;
  patchesCount: number;
  startedAt: string | null;
  error?: string;
}

// ── API Request/Response ────────────────────────────────────────────────────

export const StartScanRequestSchema = z.object({
  goal: z.string(),
  target: z.object({
    type: z.enum(['http', 'openai-compatible', 'python-fn']),
    url: z.string().optional(),
    pythonFn: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }),
  model: z.object({
    provider: z.enum(['openai', 'anthropic', 'ollama']).default('openai'),
    model: z.string().default('gpt-4o'),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
  }),
  owaspIds: z.array(OwaspIdSchema).optional(),
  maxIterations: z.number().min(1).max(10).default(3),
  applyPatches: z.boolean().default(false),
  allowOpenCritical: z.boolean().default(false),
});

export type StartScanRequest = z.infer<typeof StartScanRequestSchema>;

export interface RunSummary {
  runId: string;
  status: RunStatus;
  goal: string;
  target: string;
  startedAt: string;
  finishedAt: string | null;
  findingsCount: number;
  openCount: number;
  closedCount: number;
}
