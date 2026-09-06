/**
 * CyberPulse Core — Shared Types
 *
 * All types used across CLI, GUI, and API layers.
 * Single source of truth for the domain model.
 */
import { z } from 'zod';
export declare const OwaspIdSchema: z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>;
export type OwaspId = z.infer<typeof OwaspIdSchema>;
export declare const SeveritySchema: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
export type Severity = z.infer<typeof SeveritySchema>;
export declare const SEVERITY_ORDER: Record<Severity, number>;
export declare const RunStatusSchema: z.ZodEnum<["running", "partial", "complete", "error"]>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
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
export type PatchKind = 'prompt' | 'code';
export interface Patch {
    id: string;
    findingId: string;
    owaspId: OwaspId;
    kind: PatchKind;
    rationale: string;
    requiresRestart: boolean;
    applied: boolean;
    before?: string;
    after?: string;
    file?: string;
    diff?: string;
    zodSchema?: string;
}
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
export type ScanPhase = 'idle' | 'initializing' | 'recon' | 'attack' | 'classify' | 'remediate' | 'retest' | 'complete' | 'error';
export interface ScanStatus {
    runId: string | null;
    phase: ScanPhase;
    progress: number;
    currentOwasp: OwaspId | null;
    iterations: number;
    findingsCount: number;
    patchesCount: number;
    startedAt: string | null;
    error?: string;
}
export declare const StartScanRequestSchema: z.ZodObject<{
    goal: z.ZodString;
    target: z.ZodObject<{
        type: z.ZodEnum<["http", "openai-compatible", "python-fn"]>;
        url: z.ZodOptional<z.ZodString>;
        pythonFn: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "http" | "openai-compatible" | "python-fn";
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        pythonFn?: string | undefined;
    }, {
        type: "http" | "openai-compatible" | "python-fn";
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        pythonFn?: string | undefined;
    }>;
    model: z.ZodObject<{
        provider: z.ZodDefault<z.ZodEnum<["openai", "anthropic", "ollama"]>>;
        model: z.ZodDefault<z.ZodString>;
        apiKey: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider: "openai" | "anthropic" | "ollama";
        model: string;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
    }, {
        provider?: "openai" | "anthropic" | "ollama" | undefined;
        model?: string | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
    }>;
    owaspIds: z.ZodOptional<z.ZodArray<z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>, "many">>;
    maxIterations: z.ZodDefault<z.ZodNumber>;
    applyPatches: z.ZodDefault<z.ZodBoolean>;
    allowOpenCritical: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    model: {
        provider: "openai" | "anthropic" | "ollama";
        model: string;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
    };
    goal: string;
    target: {
        type: "http" | "openai-compatible" | "python-fn";
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        pythonFn?: string | undefined;
    };
    maxIterations: number;
    applyPatches: boolean;
    allowOpenCritical: boolean;
    owaspIds?: ("LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10")[] | undefined;
}, {
    model: {
        provider?: "openai" | "anthropic" | "ollama" | undefined;
        model?: string | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
    };
    goal: string;
    target: {
        type: "http" | "openai-compatible" | "python-fn";
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        pythonFn?: string | undefined;
    };
    owaspIds?: ("LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10")[] | undefined;
    maxIterations?: number | undefined;
    applyPatches?: boolean | undefined;
    allowOpenCritical?: boolean | undefined;
}>;
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
