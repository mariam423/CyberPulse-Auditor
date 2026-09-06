/**
 * QwenPaw Adapter
 *
 * This module is the ONLY place that knows whether QwenPaw is:
 * (a) a real external package we import, OR
 * (b) a logical name for the in-repo multi-agent kernel we implement
 *
 * Architecture:
 *   Custom Orchestrator (outer loop) → QwenPawAdapter → QwenPaw kernel
 *
 * If QwenPaw is a real package: import it here, delegate to its API.
 * If QwenPaw is not yet available: implement the kernel interface in-repo,
 * and this adapter becomes the no-op identity.
 *
 * The Custom Orchestrator talks to this adapter via the contracts in §3.6 of ARCHITECTURE.md
 * (AttackInput, AttackOutput, Finding, Patch, RetestResult).
 */

import { logger } from '../util/logger.js';
import type { RunId } from '../util/ids.js';

// --- Shared types for the kernel contract ---

export interface QwenPawAgentConfig {
  name: string;
  systemPrompt: string;
  tools: string[];
}

export interface QwenPawStepResult {
  step: string;
  output: unknown;
  durationMs: number;
  error?: string;
}

export interface QwenPawIterationResult {
  runId: RunId;
  iteration: number;
  steps: QwenPawStepResult[];
  findings: unknown[];
  patches: unknown[];
  status: 'success' | 'partial' | 'error';
}

/**
 * QwenPaw kernel interface.
 * This is the contract between the Custom Orchestrator and the QwenPaw kernel.
 */
export interface IQwenPawKernel {
  /**
   * Run one iteration of the closed-loop workflow.
   * The kernel drives: recon → attack → classify → remediate → retest.
   */
  runIteration(
    runId: RunId,
    iteration: number,
    input: unknown
  ): Promise<QwenPawIterationResult>;

  /**
   * Register an agent with the kernel.
   */
  registerAgent(config: QwenPawAgentConfig): void;

  /**
   * Interrupt the current run (for human-in-the-loop approval).
   */
  interrupt(reason: string): void;
}

// --- In-repo QwenPaw kernel implementation (used when no external package exists) ---

import { Attacker } from '../agents/attacker.js';
import { Defender } from '../agents/defender.js';
import { Validator } from '../agents/validator.js';
import { OwaspEvaluator } from '../owasp/evaluator.js';
import type { ModelClient } from '../model/types.js';
import type { TargetAdapter } from '../targets/types.js';
import type { AttackInput } from '../agents/attacker.js';
import type { ValidatorInput } from '../agents/validator.js';
import { getPayloads } from '../redteam/payloads/index.js';
import type { OwaspId } from '../owasp/types.js';

/**
 * In-repo implementation of the QwenPaw kernel contract.
 * Implements the multi-agent workflow for a single iteration.
 *
 * Agents used:
 *   - Attacker: probes the target with OWASP payloads
 *   - OwaspEvaluator: maps attack transcripts to findings
 *   - Defender: generates remediation patches
 *   - Validator: retests patched target
 */
export class InRepoQwenPawKernel implements IQwenPawKernel {
  private readonly model: ModelClient;
  private readonly target: TargetAdapter;
  private readonly maxMutations: number;

  constructor(model: ModelClient, target: TargetAdapter, maxMutations = 3) {
    this.model = model;
    this.target = target;
    this.maxMutations = maxMutations;
  }

  async runIteration(
    runId: RunId,
    iteration: number,
    input: unknown
  ): Promise<QwenPawIterationResult> {
    const { goal, targetDescriptor, owaspIds } = input as {
      goal: string;
      targetDescriptor: string;
      owaspIds: OwaspId[];
    };

    logger.info('qwenpaw:kernel', `Run ${runId} iteration ${iteration}: starting`);
    const steps: QwenPawStepResult[] = [];
    const allFindings: unknown[] = [];
    const allPatches: unknown[] = [];

    // Step 1: Recon — gather target info
    const reconStart = Date.now();
    try {
      const pingable = await this.target.ping();
      steps.push({
        step: 'recon',
        output: { targetId: this.target.id, reachable: pingable },
        durationMs: Date.now() - reconStart,
      });
    } catch (err) {
      steps.push({
        step: 'recon',
        output: null,
        durationMs: Date.now() - reconStart,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Step 2: Attack — probe each OWASP id
    for (const owaspId of owaspIds) {
      const attackStart = Date.now();
      try {
        const attacker = new Attacker(this.model, this.target);

        const attackInput: AttackInput = {
          plan: {
            owaspId,
            goal,
            targetDescriptor,
          },
          useMutations: true,
          maxMutations: this.maxMutations,
        };

        const attackOutput = await attacker.run(attackInput);

        steps.push({
          step: `attack:${owaspId}`,
          output: {
            payloadsTried: attackOutput.results.length,
            successes: attackOutput.results.filter((r) => r.success).length,
          },
          durationMs: Date.now() - attackStart,
        });

        // Step 3: Classify — evaluate transcripts to findings
        const evalStart = Date.now();
        const evaluator = new OwaspEvaluator();
        const transcripts = attackOutput.results.map((r) => ({
          owaspId,
          targetId: this.target.id,
          turns: r.turns as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
          rawResponse: r.rawResponse,
          success: r.success,
        }));

        const findings = evaluator.evaluateBatch(transcripts);
        allFindings.push(...findings);

        steps.push({
          step: `classify:${owaspId}`,
          output: { findingsCount: findings.length },
          durationMs: Date.now() - evalStart,
        });
      } catch (err) {
        steps.push({
          step: `attack:${owaspId}`,
          output: null,
          durationMs: Date.now() - attackStart,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Step 4: Remediate — generate patches for findings
    if (allFindings.length > 0) {
      const remediateStart = Date.now();
      try {
        const defender = new Defender();
        const defenderInput = {
          findings: allFindings.map((f: unknown) => {
            const finding = f as Record<string, unknown>;
            return {
              id: finding.id as string,
              owaspId: finding.owaspId as OwaspId,
              severity: finding.severity as string,
              title: finding.title as string,
              evidence: finding.evidence as string,
              repro: finding.repro as { payload: string; target: string; expected: string },
            };
          }),
          systemPrompt: 'You are a helpful AI assistant.',
        };

        const defenderOutput = await defender.run(defenderInput);
        allPatches.push(...defenderOutput.plan.patches);

        steps.push({
          step: 'remediate',
          output: { patchesCount: defenderOutput.plan.patches.length },
          durationMs: Date.now() - remediateStart,
        });

        // Step 5: Retest — validate patches
        for (const patch of defenderOutput.plan.patches) {
          if (patch.kind !== 'prompt') continue;
          const retestStart = Date.now();
          try {
            const validator = new Validator(this.target);
            const validatorInput: ValidatorInput = {
              findingId: (patch as Record<string, unknown>).owaspId as string,
              owaspId: (patch as Record<string, unknown>).owaspId as OwaspId,
              blockedPayload: (patch as Record<string, unknown>).before as string,
              patchedSystemPrompt: (patch as Record<string, unknown>).after as string,
              runMutations: true,
            };

            const retestOutput = await validator.run(validatorInput);

            steps.push({
              step: `retest:${patch.owaspId}`,
              output: { verdict: retestOutput.verdict, closed: retestOutput.closed },
              durationMs: Date.now() - retestStart,
            });
          } catch (err) {
            steps.push({
              step: `retest:${patch.owaspId}`,
              output: null,
              durationMs: Date.now() - retestStart,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } catch (err) {
        steps.push({
          step: 'remediate',
          output: null,
          durationMs: Date.now() - remediateStart,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const status: QwenPawIterationResult['status'] = steps.some((s) => s.error) ? 'partial' : 'success';

    logger.info('qwenpaw:kernel', `Run ${runId} iteration ${iteration}: complete (${steps.length} steps, ${allFindings.length} findings, ${allPatches.length} patches)`);

    return {
      runId,
      iteration,
      steps,
      findings: allFindings,
      patches: allPatches,
      status,
    };
  }

  registerAgent(_config: QwenPawAgentConfig): void {
    // In-repo kernel doesn't need agent registration
  }

  interrupt(_reason: string): void {
    logger.warn('qwenpaw:kernel', 'Interrupt requested — not implemented in in-repo kernel');
  }
}

// --- Public factory ---

/**
 * Create the QwenPaw kernel.
 * Checks whether QwenPaw is available as a real package;
 * falls back to the in-repo implementation.
 *
 * TODO: When a real QwenPaw package is available, import it here and delegate.
 * For now, always returns the in-repo implementation.
 */
export function createQwenPawKernel(
  model: ModelClient,
  target: TargetAdapter,
  maxMutations?: number
): IQwenPawKernel {
  logger.info('qwenpaw:adapter', 'Creating in-repo QwenPaw kernel (no external package detected)');
  return new InRepoQwenPawKernel(model, target, maxMutations);
}
