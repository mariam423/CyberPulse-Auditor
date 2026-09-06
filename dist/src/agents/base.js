import { logger } from '../util/logger.js';
/**
 * Base class for all CyberPulse agents.
 * Subclasses implement a Zod input/output contract with built-in retry,
 * structured logging, and metrics collection.
 */
export class Agent {
    name;
    maxRetries;
    metrics = { attempts: 0, errors: 0, lastAttemptMs: 0 };
    constructor(name, maxRetries = 3) {
        this.name = name;
        this.maxRetries = maxRetries;
    }
    /**
     * Run the agent with retry and Zod validation.
     * Validates input before calling, validates output after each attempt.
     */
    async run(input) {
        const validatedInput = this.inputSchema.parse(input);
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            this.metrics.attempts++;
            const start = Date.now();
            try {
                logger.debug(`agent:${this.name}`, `Attempt ${attempt + 1}/${this.maxRetries + 1}`);
                const raw = await this.invoke(validatedInput, attempt);
                const output = this.outputSchema.parse(raw);
                this.metrics.lastAttemptMs = Date.now() - start;
                logger.info(`agent:${this.name}`, `Succeeded in ${this.metrics.lastAttemptMs}ms (attempt ${attempt + 1})`);
                return output;
            }
            catch (err) {
                this.metrics.lastAttemptMs = Date.now() - start;
                this.metrics.errors++;
                lastError = err;
                const isRetryable = err instanceof Error &&
                    (err.message.includes('429') ||
                        err.message.includes('500') ||
                        err.message.includes('502') ||
                        err.message.includes('503') ||
                        err.message.includes('timeout'));
                if (!isRetryable || attempt === this.maxRetries) {
                    logger.error(`agent:${this.name}`, `Failed after ${attempt + 1} attempts`, err);
                    throw err;
                }
                const delay = Math.min(1000 * 2 ** attempt, 15_000);
                logger.warn(`agent:${this.name}`, `Retrying in ${delay}ms after: ${err.message}`);
                await sleep(delay);
            }
        }
        throw lastError;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    resetMetrics() {
        this.metrics = { attempts: 0, errors: 0, lastAttemptMs: 0 };
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=base.js.map