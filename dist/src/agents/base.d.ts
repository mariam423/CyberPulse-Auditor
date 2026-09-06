import { z } from 'zod';
export interface AgentMetrics {
    attempts: number;
    errors: number;
    lastAttemptMs: number;
}
/**
 * Base class for all CyberPulse agents.
 * Subclasses implement a Zod input/output contract with built-in retry,
 * structured logging, and metrics collection.
 */
export declare abstract class Agent<I, O> {
    protected readonly name: string;
    protected readonly maxRetries: number;
    protected metrics: AgentMetrics;
    constructor(name: string, maxRetries?: number);
    /**
     * The Zod input schema for this agent. Used for validation before calling `run`.
     */
    abstract readonly inputSchema: z.ZodType<I>;
    /**
     * The Zod output schema for this agent. Used for validation after `invoke`.
     */
    abstract readonly outputSchema: z.ZodType<O>;
    /**
     * Core logic — runs once per invocation, no retries.
     * Subclasses implement this with their actual LLM call or tool logic.
     */
    protected abstract invoke(input: I, attempt: number): Promise<O>;
    /**
     * Run the agent with retry and Zod validation.
     * Validates input before calling, validates output after each attempt.
     */
    run(input: unknown): Promise<O>;
    getMetrics(): AgentMetrics;
    resetMetrics(): void;
}
