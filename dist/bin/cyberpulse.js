#!/usr/bin/env node
/**
 * CyberPulse Auditor — CLI Entry Point
 *
 *   cyberpulse             → Interactive ASCII menu (wizard / GUI / help)
 *   cyberpulse gui         → Launch GUI dashboard directly
 *   cyberpulse audit ...   → Direct CLI audit with flags
 *   cyberpulse retest ...  → Re-test a finding
 *   cyberpulse report ...  → Generate a report for a run
 *   cyberpulse rules ...   → Validate custom YAML security rules
 *
 * Built binary: dist/bin/cyberpulse.js (declared in package.json "bin").
 */
(async () => {
    const [chalk, banner, errors] = await Promise.all([
        import('chalk'),
        import('../src/util/banner.js'),
        import('../src/cli/errors.js'),
    ]);
    const { printBanner, printInteractiveMenu } = banner;
    const { installCrashGuards, installSignalHandlers, EXIT } = errors;
    // ── Global verbosity flags — flip the logger before anything runs ────────────
    const rawArgs = process.argv.slice(2);
    const firstArg = rawArgs[0] ?? '';
    const debug = rawArgs.includes('--debug');
    installCrashGuards(debug);
    if (process.stdin.isTTY)
        installSignalHandlers();
    if (debug) {
        const { logger } = await import('../src/util/logger.js');
        logger.enableDebug();
    }
    else if (rawArgs.includes('--verbose')) {
        const { logger } = await import('../src/util/logger.js');
        logger.enableVerbose();
    }
    // ── `cyberpulse gui` — Launch GUI dashboard ───────────────────────────────────
    // (delegated to commander's gui command for validated flags + unified errors)
    // ── `cyberpulse` (no args) — Interactive menu ─────────────────────────────────
    if (!firstArg || firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
        if (firstArg) {
            // Any help form → delegate to commander's styled help output
            const { buildProgram } = await import('../src/cli/program.js');
            buildProgram().parse(['node', 'cyberpulse', '--help']);
            return;
        }
        printInteractiveMenu();
        const readline = await import('node:readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(chalk.default.gray('  Select an option '), async (choice) => {
            rl.close();
            console.clear();
            try {
                switch (choice.trim()) {
                    case '1': {
                        const { runInteractive } = await import('../src/cli/interactive.js');
                        await runInteractive();
                        break;
                    }
                    case '2': {
                        printBanner();
                        console.log(chalk.default.bold.cyan('  Launching GUI Dashboard...\n'));
                        const { launchGui } = await import('../src/core/gui-launcher.js');
                        const server = await launchGui({ port: 3000, open: true, detached: true });
                        console.log(`  ${chalk.default.green('✔')} GUI starting at ${chalk.default.cyan(server.url)}`);
                        console.log(chalk.default.dim('  Press Ctrl+C to stop the server.\n'));
                        process.stdin.resume();
                        break;
                    }
                    case '3': {
                        const { buildProgram } = await import('../src/cli/program.js');
                        buildProgram().parse(['node', 'cyberpulse', 'audit', '--help']);
                        break;
                    }
                    default: {
                        console.log(chalk.default.yellow(`\n  Unknown option "${choice.trim()}". Run `) +
                            chalk.default.cyan('cyberpulse --help') +
                            chalk.default.yellow(' for usage.\n'));
                        process.exit(EXIT.usageError);
                    }
                }
            }
            catch (err) {
                const { emitError } = await import('../src/cli/errors.js');
                emitError(err, 'interactive menu');
                process.exit(EXIT.runError);
            }
        });
        return;
    }
    // ── All other commands (audit / retest / report / rules / version) ────────────
    const { buildProgram } = await import('../src/cli/program.js');
    buildProgram().parse(process.argv);
})();
export {};
//# sourceMappingURL=cyberpulse.js.map