import { z } from 'zod';
/** Patch kinds */
export const PatchKind = z.enum(['prompt', 'code']);
export const Patch = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('prompt'), owaspId: z.string(), before: z.string(), after: z.string(), rationale: z.string(), changes: z.array(z.object({ type: z.enum(['add', 'remove', 'replace']), text: z.string() })) }),
    z.object({ kind: z.literal('code'), owaspId: z.string(), file: z.string(), diff: z.string(), zodSchema: z.string(), rationale: z.string(), requiresRestart: z.boolean() }),
]);
//# sourceMappingURL=types.js.map