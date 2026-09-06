import { z } from 'zod';
export const OwaspIdSchema = z.enum([
    'LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05',
    'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10',
]);
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const OwaspEntrySchema = z.object({
    id: OwaspIdSchema,
    title: z.string(),
    description: z.string(),
    severity: SeveritySchema,
    common_patterns: z.array(z.string()),
    mitigation: z.string(),
});
export const SEVERITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
};
export function severityGt(a, b) {
    return SEVERITY_ORDER[a] < SEVERITY_ORDER[b];
}
//# sourceMappingURL=types.js.map