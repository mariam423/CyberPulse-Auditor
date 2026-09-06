import { z } from 'zod';
export const TargetTypeSchema = z.enum(['http', 'openai-compatible', 'python-fn']);
export const TargetConfigSchema = z.object({
    type: TargetTypeSchema,
    url: z.string().optional(), // for http / openai-compatible
    headers: z.record(z.string()).optional(),
    pythonFn: z.string().optional(), // for python-fn: "module.function" or "module:fn"
    timeout: z.number().min(1_000).default(30_000),
});
//# sourceMappingURL=types.js.map