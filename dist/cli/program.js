import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../util/logger.js';
import { createModelClient } from '../model/provider.js';
import { createTargetAdapter } from '../targets/adapter.js';
import { loadCatalog } from '../owasp/catalog.js';
import { SqliteStore } from '../store/sqlite.js';
import { newRunId } from '../util/ids.js';
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
    output: z.enum(['json', 'markdown', 'sarif', 'text']).default('text'),
    dbPath: z.string().optional(),
});
export async function runAudit(opts) {
    const runId = newRunId();
    const store = new SqliteStore(opts.dbPath);
    logger.info('cli:audit', `Starting run ${runId} against ${opts.target.type}`);
    // Load OWASP catalog
    const catalog = loadCatalog();
    logger.info('cli:audit', `Loaded ${catalog.size} OWASP entries`);
    // Initialize target adapter
    const target = createTargetAdapter({ ...opts.target, timeout: 30_000 });
    // Initialize model client
    const model = createModelClient({
        ...opts.model,
        timeout: 60_000,
        maxRetries: 3,
    });
    // Create run record
    store.createRun(runId, JSON.stringify(opts.target), opts);
    // Create a stub run result for the hello-world phase
    const findings = Array.from(catalog.values()).map((entry) => ({
        id: `fnd_${Math.random().toString(36).slice(2, 10)}`,
        owaspId: entry.id,
        severity: entry.severity,
        title: entry.title,
        evidence: `Stub finding for ${entry.id} — replace with real Attacker output in Phase 2`,
        repro: { payload: 'stub', target: opts.target.url ?? opts.target.pythonFn ?? 'unknown', expected: 'N/A' },
    }));
    // Write findings to store
    for (const f of findings) {
        store.addFinding({
            id: f.id,
            runId,
            owaspId: f.owaspId,
            severity: f.severity,
            title: f.title,
            evidence: f.evidence,
            repro: f.repro,
        });
    }
    // Finish run
    store.finishRun(runId, 'complete');
    // Output
    if (opts.output === 'json') {
        console.log(JSON.stringify({
            runId,
            status: 'complete',
            findings: findings.map((f) => ({
                id: f.id,
                owaspId: f.owaspId,
                severity: f.severity,
                title: f.title,
            })),
        }, null, 2));
    }
    else {
        console.log(chalk.green(`✓ Run ${runId} complete — ${findings.length} findings written to store`));
        console.log(chalk.gray(`  Use: cyberpulse report --run ${runId}`));
    }
    store.close();
}
export function buildProgram() {
    const program = new Command();
    program
        .name('cyberpulse')
        .description('CyberPulse Auditor — Multi-Agent LLM Security Copilot')
        .version('0.1.0');
    // audit command
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
        .option('--output <format>', 'Output format: json | text | markdown | sarif', 'text')
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
    // retest command
    const retest = program.command('retest');
    retest
        .description('Re-run validation against a specific finding')
        .requiredOption('--run <id>', 'Run ID')
        .requiredOption('--finding <id>', 'Finding ID to retest')
        .option('--output <format>', 'Output format: json | text', 'text')
        .action(async (opts) => {
        try {
            console.log(chalk.yellow(`[retest] Run: ${opts.run}, Finding: ${opts.finding}`));
            console.log(chalk.gray('Retest functionality is stubbed in Phase 1. Full retest in Phase 4.'));
        }
        catch (err) {
            logger.error('cli', 'Retest failed', err);
            process.exit(1);
        }
    });
    // report command
    const report = program.command('report');
    report
        .description('Generate a report for a completed run')
        .requiredOption('--run <id>', 'Run ID')
        .requiredOption('--format <format>', 'Report format: json | markdown | sarif | text', 'text')
        .option('--output <file>', 'Output file (stdout if omitted)')
        .option('--db-path <path>', 'SQLite database path', 'data/cyberpulse.db')
        .action(async (opts) => {
        try {
            const store = new SqliteStore(opts.dbPath);
            const run = store.getRun(opts.run);
            if (!run) {
                console.error(chalk.red(`Run ${opts.run} not found`));
                process.exit(1);
            }
            const findings = store.getFindingsByRun(opts.run);
            if (opts.format === 'json') {
                console.log(JSON.stringify({
                    run: opts.run,
                    status: run.status,
                    findings: findings.map((f) => ({
                        id: f.id,
                        owaspId: f.owasp_id,
                        severity: f.severity,
                        title: f.title,
                        closed: f.closed === 1,
                        evidence: f.evidence,
                    })),
                }, null, 2));
            }
            else {
                console.log(chalk.bold(`\nCyberPulse Audit Report — Run ${opts.run}\n`));
                console.log(chalk.gray(`Status: ${run.status} | Target: ${run.target}`));
                console.log(chalk.gray(`Started: ${run.started_at} | Finished: ${run.finished_at ?? 'N/A'}\n`));
                console.log(chalk.bold(`${findings.length} Findings:\n`));
                for (const f of findings) {
                    const sevColor = f.severity === 'critical' ? chalk.red : f.severity === 'high' ? chalk.orange : f.severity === 'medium' ? chalk.yellow : chalk.gray;
                    console.log(sevColor(`[${f.severity.toUpperCase()}]`) + ` ${f.owasp_id} — ${f.title}`);
                    console.log(chalk.gray(`  Evidence: ${f.evidence.slice(0, 120)}...`));
                    console.log();
                }
            }
            store.close();
        }
        catch (err) {
            logger.error('cli', 'Report failed', err);
            process.exit(1);
        }
    });
    return program;
}
//# sourceMappingURL=program.js.map