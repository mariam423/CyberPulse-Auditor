import { z } from 'zod';

export const TargetTypeSchema = z.enum(['http', 'openai-compatible', 'python-fn']);
export type TargetType = z.infer<typeof TargetTypeSchema>;

export const TargetConfigSchema = z.object({
  type: TargetTypeSchema,
  url: z.string().optional(),           // for http / openai-compatible
  headers: z.record(z.string()).optional(),
  pythonFn: z.string().optional(),       // for python-fn: "module.function" or "module:fn"
  timeout: z.number().min(1_000).default(30_000),
});
export type TargetConfig = z.infer<typeof TargetConfigSchema>;

/** A single turn in a conversation with the target */
export interface TargetTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Full attack transcript for one probe */
export interface AttackTranscript {
  targetId: string;
  owaspId: string;
  turns: TargetTurn[];
  rawResponse: string;
  success: boolean;
  error?: string;
}

export interface TargetAdapter {
  /** Human-readable target id */
  readonly id: string;
  /** Send a message to the target and return the response text */
  call(messages: TargetTurn[]): Promise<string>;
  /** Probe the target for reachability */
  ping(): Promise<boolean>;
}
