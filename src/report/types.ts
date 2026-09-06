import type { RunId } from '../util/ids.js';

export interface RunReport {
  runId: RunId;
  status: 'complete' | 'partial' | 'error';
  startedAt: string;
  finishedAt: string;
  target: string;
  goal: string;
  iterations: number;
  findings: FindingReport[];
  patches: PatchReport[];
  retests: RetestReport[];
}

export interface FindingReport {
  id: string;
  owaspId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  evidence: string;
  repro: {
    payload: string;
    target: string;
    expected: string;
  };
  closed: boolean;
  closedBy?: string; // patch id that closed it
}

export interface PatchReport {
  id: string;
  findingId: string;
  owaspId: string;
  kind: 'prompt' | 'code';
  rationale: string;
  requiresRestart: boolean;
  applied: boolean;
}

export interface RetestReport {
  findingId: string;
  verdict: 'closed' | 'open' | 'inconclusive';
  attemptsCount: number;
  evidence: string;
}
