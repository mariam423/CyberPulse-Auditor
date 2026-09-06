import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../util/logger.js';
import { createModelClient } from '../model/provider.js';
import { createTargetAdapter } from '../targets/adapter.js';
import { loadCatalog } from '../owasp/catalog.js';
import { SqliteStore } from '../store/sqlite.js';
import { Orchestrator, OrchestratorConfigSchema } from '../orchestrator/orchestrator.js';
import { formatMarkdown } from '../report/markdown.js';
import { formatSarif } from '../report/sarif.js';
import { formatHtml } from '../report/html.js';
import { formatJson } from '../report/json.js';
import { formatTextReport } from '../report/text.js';
import { newRetestId } from '../util/ids.js';
import { z } from 'zod';
export const AuditOptionsSchema = z.object({
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
    goal: z.string(),
    maxIterations: z.number().min(1).max(10).default(3),
    apply: z.boolean().default(false),
    allowOpenCritical: z.boolean().default(false),
    output: z.enum(['json', 'markdown', 'sarif', 'text', 'html']).default('text'),
    outputFile: z.string().optional(),
    dbPath: z.string().optional(),
});
function writeOutput(content, outputFile) {
    if (outputFile) {
        const resolved = resolve(outputFile);
        writeFileSync(resolved, content, 'utf-8');
        console.log(chalk.green(`✓ Report written to ${resolved}`));
    }
    else {
        console.log(content);
    }
}
export async function runAudit(opts) {
    logger.info('cli:audit', `Starting run against ${opts.target.type}`);
    // Load OWASP catalog
    const catalog = loadCatalog();
    logger.info('cli:audit', `Loaded ${catalog.size} OWASP entries`);
    // Build owaspIds array from all catalog entries
    const owaspIds = Array.from(catalog.keys());
    // Initialize target adapter
    const target = createTargetAdapter({ ...opts.target, timeout: 30_000 });
    // Initialize model client
    const model = createModelClient({
        ...opts.model,
        timeout: 60_000,
        maxRetries: 3,
    });
    // Build orchestrator config
    const config = OrchestratorConfigSchema.parse({
        goal: opts.goal,
        targetDescriptor: JSON.stringify(opts.target),
        owaspIds,
        maxIterations: opts.maxIterations,
        applyPatches: opts.apply,
        allowOpenCritical: opts.allowOpenCritical,
        dbPath: opts.dbPath,
    });
    // Run the full closed-loop audit
    const orchestrator = new Orchestrator(config, model, target, opts.dbPath);
    let result;
    try {
        result = await orchestrator.run(opts.output);
    }
    finally {
        orchestrator.close();
    }
    // Output to file or stdout
    if (opts.outputFile) {
        writeOutput(result.output, opts.outputFile);
    }
    else {
        if (opts.output !== 'text') {
            // For non-text, just print the raw output
            console.log(result.output);
        }
        else {
            console.log(chalk.green(`✓ Run ${result.runId} complete`));
            console.log(chalk.gray(`  Status: ${result.status} | Iterations: ${result.iterations}`));
            console.log(chalk.gray(`  Findings: ${result.findings.length} | Patches: ${result.patches.length}`));
            console.log();
            console.log(result.output);
        }
    }
}
export function buildProgram() {
    const program = new Command();
    program
        .name('cyberpulse')
        .description('CyberPulse Auditor — Multi-Agent LLM Security Copilot')
        .version('0.1.0');
    // ── audit command ─────────────────────────────────────────────
    const audit = program.command('audit');
    audit
        .description('Run a full closed-loop security audit against a target')
        .requiredOption('--goal <text>', 'The security goal to probe for')
        .requiredOption('--target-url <url>', 'Target URL (for http/openai-compatible targets)')
        .requiredOption('--target-type <type>', 'Target type: http | openai-compatible | python-fn')
        .option('--target-python-fn <mod:fn>', 'Python function target (python-fn type only)')
        .option('--target-header <key:value...>', 'Extra headers for target', (val, acc) => {
        const [k, v] = val.split(':');
        if (k && v)
            acc[k] = v;
        return acc;
    }, {})
        .option('--model-provider <provider>', 'Model provider: openai | anthropic | ollama', 'openai')
        .option('--model <model>', 'Model name', 'gpt-4o')
        .option('--model-api-key <key>', 'API key (or set OPENAI_API_KEY env var)')
        .option('--model-base-url <url>', 'Base URL for the model API')
        .option('--max-iterations <n>', 'Max attack/defend iterations', '3')
        .option('--apply', 'Auto-apply patches (default: propose only)')
        .option('--allow-open-critical', 'Allow reporting with open Critical findings')
        .option('--output <format>', 'Output format: json | text | markdown | sarif | html', 'text')
        .option('--output-file <path>', 'Write report to file instead of stdout')
        .option('--db-path <path>', 'SQLite database path', 'data/cyberpulse.db')
        .action(async (opts) => {
        try {
            const options = AuditOptionsSchema.parse({
                target: {
                    type: opts.targetType,
                    url: opts.targetUrl,
                    pythonFn: opts.targetPythonFn,
                    headers: opts.targetHeader,
                },
                model: {
                    provider: opts.modelProvider,
                    model: opts.model,
                    apiKey: opts.modelApiKey,
                    baseUrl: opts.modelBaseUrl,
                },
                goal: opts.goal,
                maxIterations: parseInt(opts.maxIterations, 10),
                apply: opts.apply,
                allowOpenCritical: opts.allowOpenCritical,
                output: opts.output,
                outputFile: opts.outputFile,
                dbPath: opts.dbPath,
            });
            await runAudit(options);
        }
        catch (err) {
            logger.error('cli', 'Audit failed', err);
            if (err instanceof z.ZodError) {
                console.error(chalk.red('Validation errors:'), JSON.stringify(err.errors, null, 2));
            }
            process.exit(1);
        }
    });
    // ── retest command ────────────────────────────────────────────
    const retest = program.command('retest');
    retest
        .description('Re-run validation against a specific finding to verify a patch')
        .requiredOption('--run <id>', 'Run ID')
        .requiredOption('--finding <id>', 'Finding ID to retest')
        .option('--output <format>', 'Output format: json | text', 'text')
        .option('--output-file <path>', 'Write report to file instead of stdout')
        .option('--db-path <path>', 'SQLite database path', 'data/cyberpulse.db')
        .action(async (opts) => {
        try {
            const store = new SqliteStore(opts.dbPath);
            // Load the original run
            const run = store.getRun(opts.run);
            if (!run) {
                console.error(chalk.red(`Run ${opts.run} not found`));
                store.close();
                process.exit(1);
            }
            // Load the finding
            const findings = store.getFindingsByRun(opts.run);
            const finding = findings.find((f) => f.id === opts.finding);
            if (!finding) {
                console.error(chalk.red(`Finding ${opts.finding} not found in run ${opts.run}`));
                store.close();
                process.exit(1);
            }
            // Load patches for this finding
            const patches = store.getPatchesByFinding(opts.finding);
            // Build the target adapter (using the stored target config)
            let targetConfig = {};
            try {
                targetConfig = JSON.parse(run.target);
            }
            catch {
                // ignore parse errors
            }
            const target = createTargetAdapter({
                type: targetConfig.type,
                url: targetConfig.url,
                pythonFn: targetConfig.pythonFn,
                headers: targetConfig.headers,
                timeout: 30_000,
            });
            // Reconstruct the patched system prompt if a patch exists
            const patch = patches.find((p) => p.kind === 'prompt');
            const patchedSystemPrompt = patch?.after_or_diff;
            // Run the validator
            const { Validator } = await import('../agents/validator.js');
            const validator = new Validator(target);
            const { ValidatorInputSchema } = await import('../agents/validator.js');
            const input = ValidatorInputSchema.parse({
                findingId: finding.id,
                owaspId: finding.owasp_id,
                blockedPayload: JSON.parse(finding.repro_json).payload,
                patchedSystemPrompt,
                runMutations: true,
            });
            const output = await validator.run(input);
            // Store the retest result
            store.addRetest({
                id: newRetestId(),
                runId: run.id,
                findingId: finding.id,
                closed: output.closed,
                attempts: output.attempts,
                evidence: output.evidence,
            });
            const verdictColor = output.verdict === 'closed' ? chalk.green : output.verdict === 'open' ? chalk.red : chalk.yellow;
            const resultObj = {
                findingId: finding.id,
                owaspId: finding.owasp_id,
                verdict: output.verdict,
                closed: output.closed,
                attemptsCount: output.attempts.length,
                evidence: output.evidence,
            };
            if (opts.output === 'json') {
                writeOutput(JSON.stringify(resultObj, null, 2), opts.outputFile);
            }
            else {
                console.log(chalk.bold(`\nCyberPulse Retest — Finding ${finding.id}\n`));
                console.log(`  OWASP ID : ${finding.owasp_id}`);
                console.log(`  Verdict  : ${verdictColor(output.verdict.toUpperCase())}`);
                console.log(`  Closed   : ${output.closed ? chalk.green('YES') : chalk.red('NO')}`);
                console.log(`  Attempts : ${output.attempts.length}`);
                console.log();
                console.log(chalk.gray('Evidence:'));
                console.log(chalk.gray(output.evidence));
                if (opts.outputFile) {
                    console.log(chalk.green(`\n✓ Retest result written`));
                }
            }
            store.close();
        }
        catch (err) {
            logger.error('cli', 'Retest failed', err);
            if (err instanceof z.ZodError) {
                console.error(chalk.red('Validation errors:'), JSON.stringify(err.errors, null, 2));
            }
            process.exit(1);
        }
    });
    // ── report command ────────────────────────────────────────────
    const report = program.command('report');
    report
        .description('Generate a report for a completed run')
        .requiredOption('--run <id>', 'Run ID')
        .requiredOption('--format <format>', 'Report format: json | markdown | sarif | html | text', 'text')
        .option('--output-file <path>', 'Write report to file instead of stdout')
        .option('--db-path <path>', 'SQLite database path', 'data/cyberpulse.db')
        .action(async (opts) => {
        try {
            const store = new SqliteStore(opts.dbPath);
            const run = store.getRun(opts.run);
            if (!run) {
                console.error(chalk.red(`Run ${opts.run} not found`));
                store.close();
                process.exit(1);
            }
            const findings = store.getFindingsByRun(opts.run);
            // Reconstruct RunReport from stored data
            const config = JSON.parse(run.config_json);
            const reportRun = {
                runId: run.id,
                status: run.status,
                startedAt: run.started_at,
                finishedAt: run.finished_at ?? new Date().toISOString(),
                target: run.target,
                goal: config.goal ?? '',
                iterations: config.maxIterations ?? 1,
                findings: findings.map((f) => ({
                    id: f.id,
                    owaspId: f.owasp_id,
                    severity: f.severity,
                    title: f.title,
                    evidence: f.evidence,
                    repro: JSON.parse(f.repro_json),
                    closed: f.closed === 1,
                })),
                patches: [],
                retests: [],
            };
            const output = selectFormat(reportRun, opts.format);
            writeOutput(output, opts.outputFile);
            store.close();
        }
        catch (err) {
            logger.error('cli', 'Report failed', err);
            if (err instanceof z.ZodError) {
                console.error(chalk.red('Validation errors:'), JSON.stringify(err.errors, null, 2));
            }
            process.exit(1);
        }
    });
    return program;
}
function selectFormat(report, format) {
    switch (format) {
        case 'markdown':
            return formatMarkdown(report);
        case 'sarif':
            return JSON.stringify(formatSarif(report), null, 2);
        case 'html':
            return formatHtml(report);
        case 'json':
            return formatJson(report);
        case 'text':
        default:
            return formatTextReport(report);
    }
}
//# sourceMappingURL=program.js.map