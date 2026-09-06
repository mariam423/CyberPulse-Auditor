import { z } from 'zod';
import { Agent } from './base.js';
import { logger } from '../util/logger.js';
import { hardenPrompt } from '../remediation/prompt-hardener.js';
import { createCodePatch, validateBlockingSchema } from '../remediation/code-patch.js';
/** Input: a list of findings to remediate */
export const DefenderInputSchema = z.object({
    findings: z.array(z.object({
        id: z.string(),
        owaspId: z.enum(['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10']),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
        title: z.string(),
        evidence: z.string(),
        repro: z.object({
            payload: z.string(),
            target: z.string(),
            expected: z.string(),
        }),
    })),
    /** Optional system prompt to harden (for prompt-level patches) */
    systemPrompt: z.string().optional(),
    /** Optional source code context for code-level patches */
    sourceCode: z.string().optional(),
});
export const DefenderOutputSchema = z.object({
    plan: z.object({
        patches: z.array(z.object({
            kind: z.enum(['prompt', 'code']),
            owaspId: z.string(),
            // prompt-specific
            before: z.string().optional(),
            after: z.string().optional(),
            rationale: z.string().optional(),
            changes: z.array(z.object({ type: z.enum(['add', 'remove', 'replace']), text: z.string() })).optional(),
            // code-specific
            file: z.string().optional(),
            diff: z.string().optional(),
            zodSchema: z.string().optional(),
            requiresRestart: z.boolean().optional(),
        })),
        addressedFindings: z.array(z.string()),
        unaddressedFindings: z.array(z.string()),
        summary: z.string(),
    }),
    /** Whether each patch's Zod schema was validated against the attack payload */
    validationResults: z.record(z.boolean()),
});
/**
 * Defender agent — the defensive persona.
 * Consumes Findings, produces a RemediationPlan with PromptPatch and/or CodePatch entries.
 *
 * Strategy per finding:
 * 1. Always produce a PromptPatch (hardening rules per OWASP id).
 * 2. For critical/high severity with a code-related attack, also produce a CodePatch.
 */
export class Defender extends Agent {
    inputSchema = DefenderInputSchema;
    outputSchema = DefenderOutputSchema;
    constructor() {
        super('defender', 0); // no retries — deterministic rules
    }
    async invoke(input, _attempt) {
        const { findings, systemPrompt, sourceCode } = input;
        logger.info('defender', `Remediating ${findings.length} findings`);
        const patches = [];
        const addressedFindings = [];
        const unaddressedFindings = [];
        const validationResults = {};
        for (const finding of findings) {
            const owaspId = finding.owaspId;
            // Always produce a PromptPatch
            const promptPatch = hardenPrompt(owaspId, systemPrompt ?? 'You are a helpful AI assistant.');
            const typedPromptPatch = {
                kind: 'prompt',
                owaspId,
                before: promptPatch.before,
                after: promptPatch.after,
                rationale: promptPatch.rationale,
                changes: promptPatch.changes,
            };
            patches.push(typedPromptPatch);
            addressedFindings.push(finding.id);
            // For critical/high code-related vulnerabilities, also produce a CodePatch
            const codeRelatedIds = ['LLM01', 'LLM02', 'LLM06'];
            const shouldProduceCodePatch = (finding.severity === 'critical' || finding.severity === 'high') &&
                codeRelatedIds.includes(owaspId);
            if (shouldProduceCodePatch) {
                const codePatch = createCodePatch({
                    owaspId,
                    file: sourceCode ? '/app/handler.ts' : 'src/handler.ts',
                    attackPayload: finding.repro.payload,
                    legitimateExample: 'Hello, how can I help you?',
                    rationale: `Generated code patch to block ${owaspId} attack: ${finding.title}`,
                });
                // Validate the blocking schema
                const zodError = validateBlockingSchema(codePatch.zodSchema, finding.repro.payload);
                const schemaBlocks = zodError !== null;
                validationResults[codePatch.zodSchema.slice(0, 50)] = schemaBlocks;
                if (schemaBlocks) {
                    logger.info('defender', `CodePatch for ${finding.id}: schema correctly blocks attack`);
                }
                else {
                    logger.warn('defender', `CodePatch for ${finding.id}: schema does NOT block attack — review needed`);
                }
                patches.push(codePatch);
            }
            else {
                // Mark as validated (prompt-only)
                validationResults[finding.id] = true;
            }
        }
        const summary = buildSummary(findings, patches);
        const plan = {
            patches,
            addressedFindings,
            unaddressedFindings,
            summary,
        };
        logger.info('defender', `Remediation plan: ${patches.length} patches for ${addressedFindings.length} findings`);
        return {
            plan: {
                patches: plan.patches.map((p) => ({
                    kind: p.kind,
                    owaspId: p.owaspId,
                    ...(p.kind === 'prompt'
                        ? {
                            before: p.before,
                            after: p.after,
                            rationale: p.rationale,
                            changes: p.changes,
                        }
                        : {
                            file: p.file,
                            diff: p.diff,
                            zodSchema: p.zodSchema,
                            rationale: p.rationale,
                            requiresRestart: p.requiresRestart,
                        }),
                })),
                addressedFindings: plan.addressedFindings,
                unaddressedFindings: plan.unaddressedFindings,
                summary: plan.summary,
            },
            validationResults,
        };
    }
}
function buildSummary(findings, patches) {
    const promptPatches = patches.filter((p) => p.kind === 'prompt');
    const codePatches = patches.filter((p) => p.kind === 'code');
    return [
        `CyberPulse Defender Remediation Plan`,
        ``,
        `Addressed ${findings.length} findings with ${patches.length} patches:`,
        `  - ${promptPatches.length} PromptPatch (system prompt hardening)`,
        `  - ${codePatches.length} CodePatch (code-level validation)`,
        ``,
        findings
            .map((f) => `  [${f.owaspId}] ${f.severity.toUpperCase()}: ${f.title}`)
            .join('\n'),
    ].join('\n');
}
//# sourceMappingURL=defender.js.map