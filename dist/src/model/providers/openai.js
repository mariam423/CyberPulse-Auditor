import { ChatCompletionRequestSchema, ChatCompletionResponseSchema, } from '../types.js';
import { logger } from '../../util/logger.js';
const BASE_URL = 'https://api.openai.com/v1';
export class OpenAIProvider {
    apiKey;
    baseUrl;
    maxRetries;
    timeout;
    constructor(config) {
        this.apiKey = config.apiKey ?? (process.env['OPENAI_API_KEY'] ?? '');
        this.baseUrl = config.baseUrl ?? BASE_URL;
        this.maxRetries = config.maxRetries;
        this.timeout = config.timeout;
    }
    async chatCompletions(req) {
        const url = `${this.baseUrl}/chat/completions`;
        const body = ChatCompletionRequestSchema.parse(req);
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                logger.debug('openai', `POST ${url} attempt ${attempt + 1}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`OpenAI API error ${response.status}: ${text}`);
                }
                const json = await response.json();
                return ChatCompletionResponseSchema.parse(json);
            }
            catch (err) {
                lastError = err;
                if (err instanceof Error && err.name === 'AbortError') {
                    logger.warn('openai', `Request timed out after ${this.timeout}ms`);
                }
                const isRetryable = err instanceof Error &&
                    (err.message.includes('429') ||
                        err.message.includes('500') ||
                        err.message.includes('502') ||
                        err.message.includes('503'));
                if (!isRetryable || attempt === this.maxRetries) {
                    throw err;
                }
                const delay = Math.min(1000 * 2 ** attempt, 30_000);
                logger.info('openai', `Retrying in ${delay}ms after error: ${err.message}`);
                await sleep(delay);
            }
        }
        throw lastError;
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=openai.js.map