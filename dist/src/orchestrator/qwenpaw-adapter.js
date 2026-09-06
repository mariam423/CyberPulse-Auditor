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
// --- In-repo QwenPaw kernel implementation (used when no external package exists) ---
import { Attacker } from '../agents/attacker.js';
import { Defender } from '../agents/defender.js';
import { Validator } from '../agents/validator.js';
import { OwaspEvaluator } from '../owasp/evaluator.js';
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
export class InRepoQwenPawKernel {
    model;
    target;
    maxMutations;
    constructor(model, target, maxMutations = 3) {
        this.model = model;
        this.target = target;
        this.maxMutations = maxMutations;
    }
    async runIteration(runId, iteration, input) {
        const { goal, targetDescriptor, owaspIds } = input;
        logger.info('qwenpaw:kernel', `Run ${runId} iteration ${iteration}: starting`);
        const steps = [];
        const allFindings = [];
        const allPatches = [];
        // Step 1: Recon — gather target info
        const reconStart = Date.now();
        try {
            const pingable = await this.target.ping();
            steps.push({
                step: 'recon',
                output: { targetId: this.target.id, reachable: pingable },
                durationMs: Date.now() - reconStart,
            });
        }
        catch (err) {
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
                const attackInput = {
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
                    turns: r.turns,
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
            }
            catch (err) {
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
                    findings: allFindings.map((f) => {
                        const finding = f;
                        return {
                            id: finding.id,
                            owaspId: finding.owaspId,
                            severity: finding.severity,
                            title: finding.title,
                            evidence: finding.evidence,
                            repro: finding.repro,
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
                    if (patch.kind !== 'prompt')
                        continue;
                    const retestStart = Date.now();
                    try {
                        const validator = new Validator(this.target);
                        const validatorInput = {
                            findingId: patch.owaspId,
                            owaspId: patch.owaspId,
                            blockedPayload: patch.before,
                            patchedSystemPrompt: patch.after,
                            runMutations: true,
                        };
                        const retestOutput = await validator.run(validatorInput);
                        steps.push({
                            step: `retest:${patch.owaspId}`,
                            output: { verdict: retestOutput.verdict, closed: retestOutput.closed },
                            durationMs: Date.now() - retestStart,
                        });
                    }
                    catch (err) {
                        steps.push({
                            step: `retest:${patch.owaspId}`,
                            output: null,
                            durationMs: Date.now() - retestStart,
                            error: err instanceof Error ? err.message : String(err),
                        });
                    }
                }
            }
            catch (err) {
                steps.push({
                    step: 'remediate',
                    output: null,
                    durationMs: Date.now() - remediateStart,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        const status = steps.some((s) => s.error) ? 'partial' : 'success';
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
    registerAgent(_config) {
        // In-repo kernel doesn't need agent registration
    }
    interrupt(_reason) {
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
export function createQwenPawKernel(model, target, maxMutations) {
    logger.info('qwenpaw:adapter', 'Creating in-repo QwenPaw kernel (no external package detected)');
    return new InRepoQwenPawKernel(model, target, maxMutations);
}
//# sourceMappingURL=qwenpaw-adapter.js.map