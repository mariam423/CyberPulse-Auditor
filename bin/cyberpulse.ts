#!/usr/bin/env node

/**
 * CyberPulse Auditor — Entry Point
 *
 * Unified launcher with three operating modes:
 *
 *   cyberpulse             → Interactive ASCII menu (CLI wizard / GUI launch / direct audit)
 *   cyberpulse gui         → Launch GUI dashboard directly
 *   cyberpulse audit ...   → Direct CLI audit with flags
 *   cyberpulse retest ... → Re-test a finding
 *   cyberpulse report ...  → Generate a report for a run
 *
 * The core engine (src/core/) is shared — both CLI and GUI consume
 * the exact same logic with 100% functional parity.
 */

(async () => {
  const chalk = await import('chalk');
  const { printBanner, printInteractiveMenu } = await import('../src/util/banner.js');
  const { launchGui } = await import('../src/core/gui-launcher.js');
  const { runInteractive } = await import('../src/cli/interactive.js');
  const { buildProgram } = await import('../src/cli/program.js');

  // ── Argument parsing (minimal, before commander takes over) ────────────────────
  const rawArgs = process.argv.slice(2);
  const firstArg = rawArgs[0] ?? '';

  // ── `cyberpulse gui` — Launch GUI dashboard ───────────────────────────────────
  if (firstArg === 'gui') {
    const portArg = rawArgs.find((a) => a.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1] ?? '3000', 10) : 3000;
    const openBrowser = !rawArgs.includes('--no-open');

    printBanner();
    console.log(chalk.default.bold.cyan('  Launching GUI Dashboard...'));
    console.log(chalk.default.dim('  ──────────────────────────────────────────────────────────────'));
    console.log(`  Port:     ${chalk.default.white(port)}`);
    console.log(`  URL:      ${chalk.default.cyan(`http://localhost:${port}`)}`);
    console.log(`  Browser:  ${openBrowser ? chalk.default.green('YES — auto-opening') : chalk.default.gray('NO')}`);
    console.log(chalk.default.dim('  ──────────────────────────────────────────────────────────────'));
    console.log(chalk.default.dim('  Press Ctrl+C to stop the server.\n'));

    launchGui({ port, open: openBrowser, detached: true })
      .then((server) => {
        server.promise?.then(() => {
          console.log(`\n  ${chalk.default.green('✔')} GUI ready at ${chalk.default.cyan(server.url)}\n`);
        }).catch(() => {
          // Server may already be running or exited silently
        });
        return server;
      })
      .catch((err: Error) => {
        console.error(chalk.default.red(`\n  ✖ Failed to launch GUI: ${err.message}\n`));
        process.exit(1);
      });

    // Keep process alive
    process.stdin.resume();
    return;
  }

  // ── `cyberpulse` (no args) — Interactive menu ─────────────────────────────────
  if (!firstArg || firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
    // If --help was passed, delegate to commander
    if (firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
      const program = buildProgram();
      program.parse(['node', 'cyberpulse', '--help']);
      return;
    }

    // Interactive pick menu
    printInteractiveMenu();

    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(chalk.default.gray('  Select an option '), async (choice: string) => {
      rl.close();
      console.clear();

      switch (choice.trim()) {
        case '1': {
          await runInteractive();
          break;
        }
        case '2': {
          console.clear();
          printBanner();
          console.log(chalk.default.bold.cyan('  Launching GUI Dashboard...\n'));
          const server = await launchGui({ port: 3000, open: true, detached: true });
          console.log(`  ${chalk.default.green('✔')} GUI starting at ${chalk.default.cyan(server.url)}`);
          console.log(chalk.default.dim('  Press Ctrl+C to stop the server.\n'));
          process.stdin.resume();
          break;
        }
        case '3': {
          const program = buildProgram();
          program.parse(['node', 'cyberpulse', 'audit', '--help']);
          break;
        }
        default: {
          console.log(
            chalk.default.yellow(`\n  Unknown option. Run `) +
            chalk.default.cyan(`cyberpulse --help`) +
            chalk.default.yellow(` for usage.\n`)
          );
          process.exit(0);
        }
      }
    });
    return;
  }

  // ── All other commands (audit / retest / report / version) — delegate to commander ──
  const program = buildProgram();
  program.parse(process.argv);
})();
