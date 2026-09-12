import type { RunId, FindingId, PatchId, RetestId } from '../util/ids.js';
type RunStatus = 'running' | 'partial' | 'complete' | 'error';
interface RunRow {
    id: string;
    target: string;
    config_json: string;
    status: RunStatus;
    started_at: string;
    finished_at: string | null;
}
interface FindingRow {
    id: string;
    run_id: string;
    owasp_id: string;
    severity: string;
    title: string;
    evidence: string;
    repro_json: string;
    closed: number;
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
/** Read-model rows for unified reporting (subset of persisted tables). */
export interface RetestReadRow {
    id: string;
    run_id: string;
    finding_id: string;
    closed: number;
    attempts_json: string;
    evidence: string;
    ts: string;
}
export interface AttemptReadRow {
    id: string;
    run_id: string;
    agent: string;
    payload: string;
    response: string;
    ts: string;
}
export declare class SqliteStore {
    private readonly db;
    constructor(dbPath?: string);
    private init;
    createRun(id: RunId, target: string, config: unknown): void;
    finishRun(id: RunId, status: RunStatus): void;
    getRun(id: RunId): RunRow | undefined;
    listRuns(): RunRow[];
    addFinding(row: {
        id: FindingId;
        runId: RunId;
        owaspId: string;
        severity: string;
        title: string;
        evidence: string;
        repro: unknown;
    }): void;
    closeFinding(id: FindingId): void;
    getFindingsByRun(runId: RunId): FindingRow[];
    getOpenFindings(runId: RunId): FindingRow[];
    addPatch(row: {
        id: PatchId;
        runId: RunId;
        findingId: FindingId;
        kind: 'prompt' | 'code';
        before: string;
        afterOrDiff: string;
        zodSchema: string;
        rationale: string;
    }): void;
    getPatchesByFinding(findingId: FindingId): PatchRow[];
    getPatchesByRun(runId: RunId): PatchRow[];
    getRetestsByRun(runId: RunId): RetestReadRow[];
    getAttemptsByRun(runId: RunId): AttemptReadRow[];
    addRetest(row: {
        id: RetestId;
        runId: RunId;
        findingId: FindingId;
        closed: boolean;
        attempts: unknown[];
        evidence: string;
    }): void;
    addAttempt(row: {
        id: string;
        runId: RunId;
        agent: string;
        payload: string;
        response: string;
    }): void;
    close(): void;
}
export {};
