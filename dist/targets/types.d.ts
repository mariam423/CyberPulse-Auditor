import { z } from 'zod';
export declare const TargetType: z.ZodEnum<["http", "openai-compatible", "python-fn"]>;
export type TargetType = z.infer<typeof TargetType>;
export declare const TargetConfig: z.ZodObject<{
    type: z.ZodEnum<["http", "openai-compatible", "python-fn"]>;
    url: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    pythonFn: z.ZodOptional<z.ZodString>;
    timeout: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "http" | "openai-compatible" | "python-fn";
    timeout: number;
    url?: string | undefined;
    headers?: Record<string, string> | undefined;
    pythonFn?: string | undefined;
}, {
    type: "http" | "openai-compatible" | "python-fn";
    url?: string | undefined;
    timeout?: number | undefined;
    headers?: Record<string, string> | undefined;
    pythonFn?: string | undefined;
}>;
export type TargetConfig = z.infer<typeof TargetConfig>;
/** A single turn in a conversation with the target */
export interface TargetTurn {
    role: 'user' | 'assistant';
    content: string;
}
/** Full attack transcript for one probe */
export interface AttackTranscript {
    targetId: string;
    owaspId: string;
    turns: TargetTurn[];
    rawResponse: string;
    success: boolean;
    error?: string;
}
export interface TargetAdapter {
    /** Human-readable target id */
    readonly id: string;
    /** Send a message to the target and return the response text */
    call(messages: TargetTurn[]): Promise<string>;
    /** Probe the target for reachability */
    ping(): Promise<boolean>;
}
