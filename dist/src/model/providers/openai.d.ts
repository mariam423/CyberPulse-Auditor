import { z } from 'zod';
import type { ModelClient, ModelConfig } from '../types.js';
import { ChatCompletionRequestSchema, ChatCompletionResponseSchema } from '../types.js';
export declare class OpenAIProvider implements ModelClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly maxRetries;
    private readonly timeout;
    constructor(config: ModelConfig);
    chatCompletions(req: z.infer<typeof ChatCompletionRequestSchema>): Promise<z.infer<typeof ChatCompletionResponseSchema>>;
}
