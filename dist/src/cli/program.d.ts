import { Command } from 'commander';
import { z } from 'zod';
export declare const AuditOptionsSchema: z.ZodObject<{
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
    goal: z.ZodString;
    maxIterations: z.ZodDefault<z.ZodNumber>;
    apply: z.ZodDefault<z.ZodBoolean>;
    allowOpenCritical: z.ZodDefault<z.ZodBoolean>;
    output: z.ZodDefault<z.ZodEnum<["json", "markdown", "sarif", "text", "html"]>>;
    outputFile: z.ZodOptional<z.ZodString>;
    dbPath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    output: "text" | "json" | "markdown" | "sarif" | "html";
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
    allowOpenCritical: boolean;
    apply: boolean;
    dbPath?: string | undefined;
    outputFile?: string | undefined;
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
    output?: "text" | "json" | "markdown" | "sarif" | "html" | undefined;
    maxIterations?: number | undefined;
    allowOpenCritical?: boolean | undefined;
    dbPath?: string | undefined;
    apply?: boolean | undefined;
    outputFile?: string | undefined;
}>;
export type AuditOptions = z.infer<typeof AuditOptionsSchema>;
export declare function runAudit(opts: AuditOptions): Promise<void>;
export declare function buildProgram(): Command;
