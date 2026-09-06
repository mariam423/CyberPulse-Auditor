/**
 * CyberPulse Core — Shared Types
 *
 * All types used across CLI, GUI, and API layers.
 * Single source of truth for the domain model.
 */
import { z } from 'zod';
// ── OWASP ────────────────────────────────────────────────────────────────────
export const OwaspIdSchema = z.enum([
    'LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05',
    'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10',
]);
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const SEVERITY_ORDER = {
    critical: 0, high: 1, medium: 2, low: 3, info: 4,
};
// ── Run ───────────────────────────────────────────────────────────────────────
export const RunStatusSchema = z.enum(['running', 'partial', 'complete', 'error']);
// ── API Request/Response ────────────────────────────────────────────────────
export const StartScanRequestSchema = z.object({
    goal: z.string(),
    target: z.object({
        type: z.enum(['http', 'openai-compatible', 'python-fn']),
        url: z.string().optional(),
        pythonFn: z.string().optional(),
        headers: z.record(z.string()).optional(),
    }),
    model: z.object({
        provider: z.enum(['openai', 'anthropic', 'ollama']).default('openai'),
        model: z.string().default('gpt-4o'),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
    }),
    owaspIds: z.array(OwaspIdSchema).optional(),
    maxIterations: z.number().min(1).max(10).default(3),
    applyPatches: z.boolean().default(false),
    allowOpenCritical: z.boolean().default(false),
});
//# sourceMappingURL=types.js.map