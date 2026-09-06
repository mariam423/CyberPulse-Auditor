import { z } from 'zod';
export declare const ModelProviderSchema: z.ZodEnum<["openai", "anthropic", "ollama"]>;
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export declare const ModelConfigSchema: z.ZodObject<{
    provider: z.ZodEnum<["openai", "anthropic", "ollama"]>;
    model: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    provider: "openai" | "anthropic" | "ollama";
    model: string;
    maxRetries: number;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
}, {
    provider: "openai" | "anthropic" | "ollama";
    model: string;
    timeout?: number | undefined;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    maxRetries?: number | undefined;
}>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export declare const ChatMessageSchema: z.ZodObject<{
    role: z.ZodEnum<["system", "user", "assistant", "tool"]>;
    content: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string | undefined;
}, {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string | undefined;
}>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export declare const ChatCompletionRequestSchema: z.ZodObject<{
    model: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["system", "user", "assistant", "tool"]>;
        content: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        role: "system" | "user" | "assistant" | "tool";
        content: string;
        name?: string | undefined;
    }, {
        role: "system" | "user" | "assistant" | "tool";
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
        role: "system" | "user" | "assistant" | "tool";
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
        role: "system" | "user" | "assistant" | "tool";
        content: string;
        name?: string | undefined;
    }[];
    temperature?: number | undefined;
    max_tokens?: number | undefined;
    top_p?: number | undefined;
    stop?: string | string[] | undefined;
    stream?: boolean | undefined;
}>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
export declare const ChatCompletionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    model: z.ZodString;
    choices: z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        message: z.ZodObject<{
            role: z.ZodEnum<["system", "user", "assistant", "tool"]>;
            content: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            role: "system" | "user" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        }, {
            role: "system" | "user" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        }>;
        finish_reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        index: number;
        message: {
            role: "system" | "user" | "assistant" | "tool";
            content: string;
            name?: string | undefined;
        };
        finish_reason: string;
    }, {
        index: number;
        message: {
            role: "system" | "user" | "assistant" | "tool";
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
            role: "system" | "user" | "assistant" | "tool";
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
            role: "system" | "user" | "assistant" | "tool";
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
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;
export interface ModelClient {
    chatCompletions(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
