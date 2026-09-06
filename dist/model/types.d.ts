import { z } from 'zod';
export declare const ModelProvider: z.ZodEnum<["openai", "anthropic", "ollama"]>;
export type ModelProvider = z.infer<typeof ModelProvider>;
export declare const ModelConfig: z.ZodObject<{
    provider: z.ZodEnum<["openai", "anthropic", "ollama"]>;
    model: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    provider: "openai" | "anthropic" | "ollama";
    model: string;
    maxRetries: number;
    timeout: number;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
}, {
    provider: "openai" | "anthropic" | "ollama";
    model: string;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    maxRetries?: number | undefined;
    timeout?: number | undefined;
}>;
export type ModelConfig = z.infer<typeof ModelConfig>;
export declare const ChatMessage: z.ZodObject<{
    role: z.ZodEnum<["system", "user", "assistant", "tool"]>;
    content: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: "user" | "system" | "assistant" | "tool";
    content: string;
    name?: string | undefined;
}, {
    role: "user" | "system" | "assistant" | "tool";
    content: string;
    name?: string | undefined;
}>;
export type ChatMessage = z.infer<typeof ChatMessage>;
export declare const ChatCompletionRequest: z.ZodObject<{
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["system", "user", "assistant", "tool"]>;
        content: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "system" | "assistant" | "tool";
        content: string;
        name?: string | undefined;
    }, {
        role: "user" | "system" | "assistant" | "tool";
        content: string;
        name?: string | undefined;
    }>, "many">;
    temperature: z.ZodDefault<z.ZodNumber>;
    max_tokens: z.ZodOptional<z.ZodNumber>;
    top_p: z.ZodOptional<z.ZodNumber>;
    stop: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
    stream: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    model: string;
    messages: {
        role: "user" | "system" | "assistant" | "tool";
        content: string;
        name?: string | undefined;
    }[];
    temperature: number;
    stream: boolean;
    max_tokens?: number | undefined;
    top_p?: number | undefined;
    stop?: string | string[] | undefined;
}, {
    model: string;
    messages: {
        role: "user" | "system" | "assistant" | "tool";
        content: string;
        name?: string | undefined;
    }[];
    temperature?: number | undefined;
    max_tokens?: number | undefined;
    top_p?: number | undefined;
    stop?: string | string[] | undefined;
    stream?: boolean | undefined;
}>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequest>;
export declare const ChatCompletionResponse: z.ZodObject<{
    id: z.ZodString;
    model: z.ZodString;
    choices: z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        message: z.ZodObject<{
            role: z.ZodEnum<["system", "user", "assistant", "tool"]>;
            content: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            role: "user" | "system" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        }, {
            role: "user" | "system" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        }>;
        finish_reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        index: number;
        message: {
            role: "user" | "system" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        };
        finish_reason: string;
    }, {
        index: number;
        message: {
            role: "user" | "system" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        };
        finish_reason: string;
    }>, "many">;
    usage: z.ZodOptional<z.ZodObject<{
        prompt_tokens: z.ZodNumber;
        completion_tokens: z.ZodNumber;
        total_tokens: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    }, {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    model: string;
    id: string;
    choices: {
        index: number;
        message: {
            role: "user" | "system" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        };
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    } | undefined;
}, {
    model: string;
    id: string;
    choices: {
        index: number;
        message: {
            role: "user" | "system" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        };
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    } | undefined;
}>;
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponse>;
export interface ModelClient {
    chatCompletions(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
