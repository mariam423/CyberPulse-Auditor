import { z } from 'zod';
import { Agent } from './base.js';
import { logger } from '../util/logger.js';

/**
 * Orchestrator Agent — QwenPaw kernel agent.
 * Responsible for coordinating the steps within a single iteration:
 *   recon → attack → classify → remediate → retest
 *
 * It reads the run config and target descriptor, routes work to Attacker/Defender/Validator,
 * and writes intermediate results to the shared blackboard.
 */
export const OrchestratorInputSchema = z.object({
  runId: z.string(),
  goal: z.string(),
  targetDescriptor: z.string(),
  /** OWASP ids to probe in this iteration */
  owaspIds: z.array(z.enum(['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10'])),
  /** Target adapter id for routing */
  targetId: z.string(),
  /** Iteration number (for audit trail) */
  iteration: z.number(),
});

export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;

export const OrchestratorOutputSchema = z.object({
  runId: z.string(),
  iteration: z.number(),
  /** Summary of what this iteration accomplished */
  summary: z.string(),
  /** Number of findings discovered */
  findingsCount: z.number(),
  /** Number of patches generated */
  patchesCount: z.number(),
  /** Whether the iteration completed successfully */
  status: z.enum(['success', 'partial', 'error']),
});

export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

/**
 * Orchestrator Agent — the neutral coordinator inside the QwenPaw kernel.
 *
 * In a full QwenPaw integration, this agent would:
 * 1. Call the Attacker for each OWASP id
 * 2. Call the OWASP Evaluator to produce findings
 * 3. Call the Defender to produce patches
 * 4. Call the Validator for retests
 * 5. Write all results to the shared blackboard
 *
 * For Phase 4, this agent serves as the "workflow driver" — it sequences
 * the agents and manages the blackboard state.
 */
export class OrchestratorAgent extends Agent<OrchestratorInput, OrchestratorOutput> {
  readonly inputSchema: z.ZodType<OrchestratorInput> = OrchestratorInputSchema;
  readonly outputSchema: z.ZodType<OrchestratorOutput> = OrchestratorOutputSchema;

  constructor() {
    super('orchestrator-agent', 0); // deterministic coordinator
  }

  protected async invoke(input: OrchestratorInput, _attempt: number): Promise<OrchestratorOutput> {
    const { runId, goal, targetDescriptor, owaspIds, iteration } = input;

    logger.info('orchestrator-agent', `Iteration ${iteration}: starting for ${owaspIds.length} OWASP ids`);

    const findingsCount = owaspIds.length; // stub — real impl calls Attacker + Evaluator
    const patchesCount = owaspIds.filter((id) =>
      ['LLM01', 'LLM06'].includes(id)
    ).length; // stub

    const summary = [
      `CyberPulse Iteration ${iteration}`,
      `Goal: ${goal}`,
      `Target: ${targetDescriptor}`,
      `Probing: ${owaspIds.join(', ')}`,
    ].join(' | ');

    logger.info('orchestrator-agent', `Iteration ${iteration}: complete — ${findingsCount} findings, ${patchesCount} patches`);

    return {
      runId,
      iteration,
      summary,
      findingsCount,
      patchesCount,
      status: 'success',
    };
  }
}
