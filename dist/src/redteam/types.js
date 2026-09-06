import { z } from 'zod';
export const PayloadMutator = z.enum([
    'none',
    'base64',
    'hex',
    'url-encode',
    'unicode-escape',
    'role-play',
    'framing',
    'multi-turn-chain',
    'context-injection',
]);
//# sourceMappingURL=types.js.map