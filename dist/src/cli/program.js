import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../util/logger.js';
import { ui, StepTracker } from '../util/status.js';
import { OWASP_COLOR, STATUS } from '../util/banner.js';
import { createModelClient } from '../model/provider.js';
import { createTargetAdapter } from '../targets/adapter.js';
import { loadCatalog } from '../owasp/catalog.js';
import { SqliteStore } from '../store/sqlite.js';
import { Orchestrator, OrchestratorConfigSchema } from '../orchestrator/orchestrator.js';
import { newRetestId, asRunId, asFindingId } from '../util/ids.js';
import { buildRunReport, renderReport } from '../report/service.js';
import { loadRulesFile, loadRulesDir, getRuleStats } from '../rules/engine.js';
import { RuleValidationError } from '../rules/types.js';
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
    patchRoot: z.string().optional(),
    dryRunPatches: z.boolean().default(false),
    rulesFile: z.string().optional(),
    rulesDir: z.string().optional(),
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
    writeOutput(content, outputFile);
}
// ── Audit run ────────────────────────────────────────────────────────────────
export async function runAudit(opts) {
    // Section header
    ui.section('Initializing Security Audit');
    // Step tracker for the audit pipeline — drives the spinner + ✔ stamps
    const steps = new StepTracker([
        'Initializing OWASP Catalog',
        'Analyzing target adapter',
        'Initializing model client',
        'Running attack phase',
        'Evaluating findings',
        'Generating patches',
        'Running retest validation',
        'Formatting report',
    ]);
    // ── Init ──────────────────────────────────────────────────────
    steps.start('Initializing OWASP Catalog');
    const catalog = loadCatalog();
    const owaspIds = Array.from(catalog.keys());
    steps.doneWith('Initializing OWASP Catalog', `${catalog.size} entries`);
    // ── Custom rules (YAML) — loaded before any attack runs ──────────
    if (opts.rulesFile || opts.rulesDir) {
        steps.start('Loading custom rules');
        try {
            if (opts.rulesFile)
                loadRulesFile(opts.rulesFile);
            if (opts.rulesDir)
                loadRulesDir(opts.rulesDir);
            const stats = getRuleStats();
            steps.doneWith('Loading custom rules', `${stats.rulesLoaded} rules · ${stats.payloadsAdded} payloads · ${stats.indicatorsAdded} indicators`);
        }
        catch (err) {
            steps.fail('Loading custom rules');
            if (err instanceof RuleValidationError) {
                ui.error(`Custom rule validation failed: ${err.message}`);
            }
            else {
                ui.error(err instanceof Error ? err.message : String(err));
            }
            process.exit(1);
        }
    }
    // Show OWASP categories being probed + run config, compactly
    ui.kv('Goal', chalk.white(opts.goal));
    ui.kv('Target', chalk.cyan(`${opts.target.type}: ${opts.target.url ?? opts.target.pythonFn ?? 'unknown'}`));
    ui.kv('Model', chalk.cyan(`${opts.model.provider}/${opts.model.model}`));
    ui.kv('Categories', `${chalk.white(String(owaspIds.length))}  ` + owaspIds.map((id) => (OWASP_COLOR[id] ?? chalk.white)(id)).join(chalk.gray(' · ')));
    ui.blank();
    steps.start('Analyzing target adapter');
    const target = createTargetAdapter({ ...opts.target, timeout: 30_000 });
    steps.doneWith('Analyzing target adapter', target.id);
    steps.start('Initializing model client');
    const model = createModelClient({
        ...opts.model,
        timeout: 60_000,
        maxRetries: 3,
    });
    steps.doneWith('Initializing model client', `${opts.model.provider}/${opts.model.model}`);
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
    const orchestrator = new Orchestrator(config, model, target, opts.dbPath);
    let result;
    try {
        steps.start('Running attack phase');
        result = await orchestrator.run(opts.output);
        steps.doneWith('Running attack phase', `${result.findings.length} findings · ${result.iterations} iterations`);
        steps.start('Evaluating findings');
        steps.doneWith('Evaluating findings', `${result.findings.length} evaluated`);
        steps.start('Generating patches');
        steps.doneWith('Generating patches', `${result.patches.length} patches`);
        steps.start('Running retest validation');
        const closedCount = result.retests.filter((r) => r.verdict === 'closed').length;
        steps.doneWith('Running retest validation', `${closedCount}/${result.retests.length} closed`);
        // ── Autonomous auto-patch (only when --apply was requested) ──────
        if (opts.apply && result.patches.length > 0) {
            steps.start('Applying code patches');
            const { autoApplyPatches } = await import('../remediation/patch-applier.js');
            const { Defender } = await import('../agents/defender.js');
            // Re-run the deterministic Defender over the findings to obtain full
            // code patches (file + diff + zodSchema) — PatchReports carry summaries only.
            const defender = new Defender();
            const defenderOutput = await defender.run({
                findings: result.findings.map((f) => ({
                    id: f.id,
                    owaspId: f.owaspId,
                    severity: f.severity,
                    title: f.title,
                    evidence: f.evidence,
                    repro: f.repro,
                })),
                systemPrompt: 'You are a helpful AI assistant.',
            });
            const normalizedPatches = defenderOutput.plan.patches
                .filter((p) => p.kind === 'code')
                .map((p) => ({
                kind: 'code',
                owaspId: p.owaspId,
                file: p.file ?? 'src/handler.ts',
                diff: p.diff ?? '',
                zodSchema: p.zodSchema ?? '',
                rationale: p.rationale ?? '',
                requiresRestart: p.requiresRestart ?? false,
            }));
            const attackByFile = {};
            for (const f of result.findings) {
                for (const p of normalizedPatches) {
                    if (p.owaspId === f.owaspId) {
                        attackByFile[p.file] = f.repro.payload;
                    }
                }
            }
            const patchRoot = opts.patchRoot ?? process.cwd();
            const autoResult = autoApplyPatches(normalizedPatches, attackByFile, patchRoot, { dryRun: opts.dryRunPatches });
            const suffix = opts.dryRunPatches
                ? `${autoResult.approved} reviewed (dry-run)`
                : `${autoResult.applied} applied · ${autoResult.rejected.length} rejected`;
            if (autoResult.applied > 0 || opts.dryRunPatches) {
                steps.doneWith('Applying code patches', suffix);
            }
            else {
                steps.skip('Applying code patches');
            }
        }
    }
    finally {
        orchestrator.close();
    }
    // ── Results ────────────────────────────────────────────────────
    steps.start('Formatting report');
    if (opts.outputFile) {
        writeOutput(result.output, opts.outputFile);
        steps.doneWith('Formatting report', `saved to ${opts.outputFile}`);
    }
    else if (opts.output === 'text') {
        steps.doneWith('Formatting report', 'text');
        console.log(result.output);
    }
    else {
        steps.done('Formatting report');
        writeOutput(result.output, opts.outputFile);
    }
    ui.section('Audit Complete');
    const critical = result.findings.filter((f) => f.severity === 'critical' && !f.closed);
    ui.kv('Run ID', chalk.white(result.runId));
    ui.kv('Status', result.status === 'complete' ? chalk.green('complete') : hex('#f97316')(result.status));
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
}
const hex = (c) => chalk.hex(c);
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
// ── Verbosity helpers ──────────────────────────────────────────────────────────
/** Flip the structured logger to verbose (info+) or debug (debug+) mode. */
function applyVerbosity(verbose, debug) {
    if (debug)
        logger.enableDebug();
    else if (verbose)
        logger.enableVerbose();
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
        .option('--verbose', 'Show verbose internal logs (stderr)')
        .option('--debug', 'Show full debug internal logs (stderr)')
        .action(async (opts) => {
        applyVerbosity(Boolean(opts.verbose), Boolean(opts.debug));
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
        .option('--patch-root <dir>', 'Root directory for --apply code patches (default: cwd)', '.')
        .option('--dry-run-patches', 'Review + harden code patches without writing to disk')
        .option('--rules-file <path>', 'Load custom security rules from a YAML file')
        .option('--rules-dir <dir>', 'Load custom security rules from every YAML file in a directory')
        .option('--output <format>', 'Output format: json | text | markdown | sarif | html', 'text')
        .option('--output-file <path>', 'Write report to file instead of stdout')
        .option('--db-path <path>', 'SQLite database path', 'data/cyberpulse.db')
        .option('--verbose', 'Show verbose internal logs (stderr)')
        .option('--debug', 'Show full debug internal logs (stderr)')
        .action(async (opts) => {
        applyVerbosity(Boolean(opts.verbose), Boolean(opts.debug));
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
                patchRoot: opts.patchRoot,
                dryRunPatches: opts.dryRunPatches ?? false,
                rulesFile: opts.rulesFile,
                rulesDir: opts.rulesDir,
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
        .option('--verbose', 'Show verbose internal logs (stderr)')
        .option('--debug', 'Show full debug internal logs (stderr)')
        .action(async (opts) => {
        applyVerbosity(Boolean(opts.verbose), Boolean(opts.debug));
        try {
            ui.section('Retest Validation');
            const steps = new StepTracker([
                'Loading run',
                'Resolving finding',
                'Running retest validation',
            ]);
            const store = new SqliteStore(opts.dbPath);
            steps.start('Loading run');
            const run = store.getRun(asRunId(opts.run));
            if (!run) {
                steps.fail('Loading run');
                ui.error(`Run ${opts.run} not found`);
                store.close();
                process.exit(1);
            }
            steps.doneWith('Loading run', run.id);
            steps.start('Resolving finding');
            const findings = store.getFindingsByRun(asRunId(opts.run));
            const finding = findings.find((f) => f.id === opts.finding);
            if (!finding) {
                steps.fail('Resolving finding');
                ui.error(`Finding ${opts.finding} not found in run ${opts.run}`);
                store.close();
                process.exit(1);
            }
            steps.doneWith('Resolving finding', finding.owasp_id);
            const patches = store.getPatchesByFinding(asFindingId(opts.finding));
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
            ui.blank();
            steps.start('Running retest validation');
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
            steps.doneWith('Running retest validation', `${output.verdict} (${output.attempts.length} attempts)`);
            store.addRetest({
                id: newRetestId(),
                runId: run.id,
                findingId: finding.id,
                closed: output.closed,
                attempts: output.attempts,
                evidence: output.evidence,
            });
            const verdictColor = output.verdict === 'closed' ? chalk.green : output.verdict === 'open' ? chalk.red : hex('#f97316');
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
        .option('--verbose', 'Show verbose internal logs (stderr)')
        .option('--debug', 'Show full debug internal logs (stderr)')
        .action(async (opts) => {
        applyVerbosity(Boolean(opts.verbose), Boolean(opts.debug));
        try {
            ui.section('Generating Report');
            const steps = new StepTracker([
                'Loading run',
                'Formatting report',
            ]);
            steps.start('Loading run');
            // Unified report service — identical output to the GUI /api/report route.
            const reportRun = buildRunReport(opts.run, opts.dbPath);
            if (!reportRun) {
                steps.fail('Loading run');
                ui.error(`Run ${opts.run} not found`);
                process.exit(1);
            }
            steps.doneWith('Loading run', `${reportRun.runId} · ${reportRun.findings.length} findings`);
            ui.kv('Run ID', chalk.white(reportRun.runId));
            ui.kv('Status', reportRun.status === 'complete' ? chalk.green('complete') : hex('#f97316')(reportRun.status));
            ui.kv('Findings', chalk.white(`${reportRun.findings.length}`));
            ui.kv('Patches', chalk.white(`${reportRun.patches.length}`));
            ui.kv('Format', chalk.white(opts.format.toUpperCase()));
            ui.blank();
            steps.start('Formatting report');
            const output = renderReport(reportRun, opts.format);
            steps.doneWith('Formatting report', opts.format.toUpperCase());
            writeOutput(output, opts.outputFile);
            ui.blank();
            ui.success(`Report ready`);
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
    // ── rules command ─────────────────────────────────────────────
    const rules = program.command('rules');
    rules
        .description('Inspect and validate custom YAML security rules')
        .command('validate')
        .description('Validate rule file(s) without registering them — exits non-zero on any error')
        .requiredOption('--file <path>', 'Single YAML rule file to validate')
        .option('--json', 'Output machine-readable JSON result')
        .action(async (opts) => {
        try {
            const { parseRulesYaml } = await import('../rules/engine.js');
            const { readFileSync } = await import('node:fs');
            const { resolve } = await import('node:path');
            const abs = resolve(opts.file);
            const parsed = parseRulesYaml(readFileSync(abs, 'utf-8'), abs);
            const payloadCount = parsed.rules.reduce((s, r) => s + r.payloads.length, 0);
            const indicatorCount = parsed.rules.reduce((s, r) => s + r.indicators.length, 0);
            if (opts.json) {
                console.log(JSON.stringify({ valid: true, file: abs, name: parsed.name, rules: parsed.rules.length, payloads: payloadCount, indicators: indicatorCount }, null, 2));
            }
            else {
                ui.section('Custom Rules Validation');
                ui.kv('File', chalk.white(abs));
                ui.kv('Name', chalk.white(parsed.name));
                ui.kv('Rules', chalk.white(String(parsed.rules.length)));
                ui.kv('Payloads', chalk.white(String(payloadCount)));
                ui.kv('Indicators', chalk.white(String(indicatorCount)));
                ui.blank();
                ui.success('Rule file is valid');
            }
            process.exit(0);
        }
        catch (err) {
            if (err instanceof RuleValidationError) {
                if (opts.json) {
                    console.log(JSON.stringify({ valid: false, file: opts.file, error: err.message }, null, 2));
                }
                else {
                    ui.error(`Invalid rule file: ${err.message}`);
                }
            }
            else {
                ui.error(err instanceof Error ? err.message : String(err));
            }
            process.exit(1);
        }
    });
    rules
        .command('list')
        .description('List rule files registered in the current process (after --rules-file/--rules-dir load)')
        .option('--json', 'Output machine-readable JSON result')
        .action(async (opts) => {
        const stats = getRuleStats();
        if (opts.json) {
            console.log(JSON.stringify(stats, null, 2));
        }
        else {
            ui.section('Registered Custom Rules');
            if (stats.rulesLoaded === 0) {
                ui.kv('Status', chalk.gray('none loaded'));
                ui.blank();
                console.log(chalk.dim('  Load rules with: cyberpulse audit --rules-file <path> or --rules-dir <dir>'));
            }
            else {
                ui.kv('Files', chalk.white(String(stats.filesLoaded)));
                ui.kv('Rules', chalk.white(String(stats.rulesLoaded)));
                ui.kv('Payloads', chalk.white(String(stats.payloadsAdded)));
                ui.kv('Indicators', chalk.white(String(stats.indicatorsAdded)));
                ui.blank();
                ui.sub('Source files');
                for (const f of stats.files)
                    console.log(`  ${chalk.green('✔')} ${chalk.white(f)}`);
                ui.blank();
            }
        }
        process.exit(0);
    });
    return program;
}
//# sourceMappingURL=program.js.map