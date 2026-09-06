import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { ui, StepTracker } from '../util/status.js';
import { OWASP_COLOR, STATUS } from '../util/banner.js';
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
// ── Output helpers ─────────────────────────────────────────────────────────────
function writeOutput(content, outputFile) {
    if (outputFile) {
        const resolved = resolve(outputFile);
        writeFileSync(resolved, content, 'utf-8');
        ui.success(`Report saved → ${resolved}`);
    }
    else {
        console.log(content);
    }
}
function writeJson(content, outputFile) {
    if (outputFile) {
        const resolved = resolve(outputFile);
        writeFileSync(resolved, content, 'utf-8');
        ui.success(`Report saved → ${resolved}`);
    }
    else {
        console.log(content);
    }
}
// ── Audit run ────────────────────────────────────────────────────────────────
export async function runAudit(opts) {
    // Section header
    ui.section('Initializing Security Audit');
    // Show OWASP categories being probed
    const catalog = loadCatalog();
    const owaspIds = Array.from(catalog.keys());
    console.log(`  Targeting ${owaspIds.length} OWASP LLM categories:`);
    ui.owaspBanner(owaspIds);
    ui.blank();
    ui.kv('Goal', chalk.white(opts.goal));
    ui.kv('Target', chalk.cyan(`${opts.target.type}: ${opts.target.url ?? opts.target.pythonFn ?? 'unknown'}`));
    ui.kv('Model', chalk.cyan(`${opts.model.provider}/${opts.model.model}`));
    ui.kv('Iterations', chalk.white(`${opts.maxIterations}`));
    ui.kv('Output', chalk.white(opts.output.toUpperCase()));
    ui.blank();
    // Step tracker for the audit pipeline
    const steps = new StepTracker([
        'Loading OWASP catalog',
        'Initializing target adapter',
        'Initializing model client',
        'Running attack phase',
        'Evaluating findings',
        'Generating patches',
        'Running retest validation',
        'Formatting report',
    ]);
    // ── Init ──────────────────────────────────────────────────────
    steps.start('Loading OWASP catalog');
    steps.done('Loading OWASP catalog');
    ui.success(`Loaded ${catalog.size} OWASP entries`);
    steps.start('Initializing target adapter');
    const target = createTargetAdapter({ ...opts.target, timeout: 30_000 });
    steps.done('Initializing target adapter');
    steps.start('Initializing model client');
    const model = createModelClient({
        ...opts.model,
        timeout: 60_000,
        maxRetries: 3,
    });
    steps.done('Initializing model client');
    // ── Build config ───────────────────────────────────────────────
    const config = OrchestratorConfigSchema.parse({
        goal: opts.goal,
        targetDescriptor: JSON.stringify(opts.target),
        owaspIds,
        maxIterations: opts.maxIterations,
        applyPatches: opts.apply,
        allowOpenCritical: opts.allowOpenCritical,
        dbPath: opts.dbPath,
    });
    // ── Run ────────────────────────────────────────────────────────
    ui.section('Running Closed-Loop Audit');
    steps.start('Running attack phase');
    const orchestrator = new Orchestrator(config, model, target, opts.dbPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result;
    try {
        ui.pulse('Attacking target across all OWASP categories...');
        result = await orchestrator.run(opts.output);
        ui.clearPulse();
        steps.done('Running attack phase');
        steps.start('Evaluating findings');
        steps.done('Evaluating findings');
        steps.start('Generating patches');
        steps.done('Generating patches');
        steps.start('Running retest validation');
        steps.done('Running retest validation');
    }
    finally {
        orchestrator.close();
    }
    // ── Results ────────────────────────────────────────────────────
    ui.section('Audit Complete');
    steps.render();
    ui.blank();
    const open = result.findings.filter((f) => !f.closed);
    const closed = result.findings.filter((f) => f.closed);
    const critical = result.findings.filter((f) => f.severity === 'critical' && !f.closed);
    ui.kv('Run ID', chalk.white(result.runId));
    ui.kv('Status', result.status === 'complete' ? chalk.green('complete') : chalk.hex('#f97316')(result.status));
    ui.kv('Iterations', chalk.white(`${result.iterations}`));
    ui.kv('Findings', chalk.white(`${result.findings.length}`));
    ui.kv('Patches', chalk.white(`${result.patches.length}`));
    ui.blank();
    if (critical.length > 0) {
        ui.critical(`${critical.length} open CRITICAL finding(s) — fix immediately!`);
        ui.blank();
    }
    // Severity breakdown
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    for (const sev of severities) {
        const count = result.findings.filter((f) => f.severity === sev).length;
        if (count > 0) {
            ui.severityBar(sev, count, result.findings.length);
        }
    }
    ui.blank();
    // Findings list
    if (result.findings.length > 0) {
        ui.sub('Findings');
        for (const f of result.findings) {
            ui.findingRow(f.owaspId, f.severity, f.title, f.closed);
        }
        ui.blank();
    }
    // Output
    if (opts.outputFile) {
        steps.start('Formatting report');
        writeOutput(result.output, opts.outputFile);
        steps.done('Formatting report');
    }
    else {
        if (opts.output === 'text') {
            steps.start('Formatting report');
            console.log(result.output);
            steps.done('Formatting report');
        }
        else {
            writeOutput(result.output, opts.outputFile);
        }
    }
}
// ── GUI command ────────────────────────────────────────────────────────────────
async function guiCommand(opts) {
    const port = opts.port ?? 3000;
    const open = opts.open ?? true;
    const { launchGui } = await import('../core/gui-launcher.js');
    const { printBanner } = await import('../util/banner.js');
    printBanner();
    console.log(chalk.bold.cyan('  Launching GUI Dashboard...\n'));
    const server = await launchGui({ port, open, detached: true });
    console.log(`  ${chalk.green('✔')} GUI starting at ${chalk.cyan(server.url)}`);
    console.log(chalk.dim('  Press Ctrl+C to stop the server.\n'));
    await server.promise?.catch(() => {
        // Already running or exited silently
    });
}
// ── Program builder ────────────────────────────────────────────────────────────
export function buildProgram() {
    const program = new Command();
    program
        .name('cyberpulse')
        .description('CyberPulse Auditor — Multi-Agent LLM Security Copilot')
        .version('0.1.0');
    // ── gui command ─────────────────────────────────────────────
    const gui = program.command('gui');
    gui
        .description('Launch the CyberPulse GUI dashboard (Next.js web UI)')
        .option('--port <n>', 'Port to run the GUI on', '3000')
        .option('--no-open', 'Do not open the browser automatically')
        .action(async (opts) => {
        try {
            await guiCommand({ port: parseInt(opts.port, 10), open: opts.open });
        }
        catch (err) {
            ui.error('Failed to launch GUI');
            if (err instanceof Error)
                ui.error(err.message);
            process.exit(1);
        }
    });
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
            ui.error('Audit failed');
            if (err instanceof z.ZodError) {
                console.error(JSON.stringify(err.errors, null, 2));
            }
            else if (err instanceof Error) {
                ui.error(err.message);
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
            ui.section('Retest Validation');
            const store = new SqliteStore(opts.dbPath);
            const run = store.getRun(opts.run);
            if (!run) {
                ui.error(`Run ${opts.run} not found`);
                store.close();
                process.exit(1);
            }
            const findings = store.getFindingsByRun(opts.run);
            const finding = findings.find((f) => f.id === opts.finding);
            if (!finding) {
                ui.error(`Finding ${opts.finding} not found in run ${opts.run}`);
                store.close();
                process.exit(1);
            }
            const patches = store.getPatchesByFinding(opts.finding);
            let targetConfig = {};
            try {
                targetConfig = JSON.parse(run.target);
            }
            catch { /* ignore */ }
            const target = createTargetAdapter({
                type: targetConfig.type,
                url: targetConfig.url,
                pythonFn: targetConfig.pythonFn,
                headers: targetConfig.headers,
                timeout: 30_000,
            });
            const patch = patches.find((p) => p.kind === 'prompt');
            const patchedSystemPrompt = patch?.after_or_diff;
            ui.kv('Run', chalk.white(run.id));
            ui.kv('Finding', `${(OWASP_COLOR[finding.owasp_id] ?? chalk.white)(finding.owasp_id)} — ${finding.title}`);
            ui.kv('Retesting with', patchedSystemPrompt ? chalk.green('patched prompt') : chalk.gray('original prompt'));
            ui.pulse('Running retest validation...');
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
            ui.clearPulse();
            store.addRetest({
                id: newRetestId(),
                runId: run.id,
                findingId: finding.id,
                closed: output.closed,
                attempts: output.attempts,
                evidence: output.evidence,
            });
            const verdictColor = output.verdict === 'closed' ? chalk.green : output.verdict === 'open' ? chalk.red : chalk.hex('#f97316');
            const verdictIcon = output.verdict === 'closed' ? STATUS.tick : output.verdict === 'open' ? STATUS.cross : STATUS.warn;
            ui.blank();
            ui.divider();
            console.log(`  ${verdictIcon}  ${chalk.bold('Verdict')}:  ${verdictColor(output.verdict.toUpperCase())}  ` +
                `(${output.attempts.length} attempts)`);
            console.log(`  ${output.closed ? STATUS.tick : STATUS.cross}  ${chalk.bold('Closed')}:  ${output.closed ? chalk.green('YES — vulnerability mitigated') : chalk.red('NO — still vulnerable')}`);
            ui.divider();
            ui.blank();
            if (output.evidence) {
                ui.sub('Retest Evidence');
                console.log(chalk.gray(output.evidence));
                ui.blank();
            }
            const resultObj = {
                findingId: finding.id,
                owaspId: finding.owasp_id,
                verdict: output.verdict,
                closed: output.closed,
                attemptsCount: output.attempts.length,
                evidence: output.evidence,
            };
            if (opts.output === 'json') {
                writeJson(JSON.stringify(resultObj, null, 2), opts.outputFile);
            }
            else if (opts.outputFile) {
                writeJson(JSON.stringify(resultObj, null, 2), opts.outputFile);
            }
            store.close();
        }
        catch (err) {
            ui.error('Retest failed');
            if (err instanceof z.ZodError) {
                console.error(JSON.stringify(err.errors, null, 2));
            }
            else if (err instanceof Error) {
                ui.error(err.message);
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
            ui.section('Generating Report');
            const store = new SqliteStore(opts.dbPath);
            const run = store.getRun(opts.run);
            if (!run) {
                ui.error(`Run ${opts.run} not found`);
                store.close();
                process.exit(1);
            }
            const findings = store.getFindingsByRun(opts.run);
            ui.kv('Run ID', chalk.white(run.id));
            ui.kv('Status', run.status === 'complete' ? chalk.green('complete') : chalk.hex('#f97316')(run.status));
            ui.kv('Findings', chalk.white(`${findings.length}`));
            ui.kv('Format', chalk.white(opts.format.toUpperCase()));
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
            ui.blank();
            ui.pulse(`Formatting as ${opts.format.toUpperCase()}...`);
            const output = selectFormat(reportRun, opts.format);
            ui.clearPulse();
            writeOutput(output, opts.outputFile);
            ui.blank();
            ui.success(`Report ready`);
            store.close();
        }
        catch (err) {
            ui.error('Report generation failed');
            if (err instanceof z.ZodError) {
                console.error(JSON.stringify(err.errors, null, 2));
            }
            else if (err instanceof Error) {
                ui.error(err.message);
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