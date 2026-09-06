import chalk from 'chalk';

/* eslint-disable @typescript-eslint/no-explicit-any */
const hex = (c: string) => (chalk as any).hex(c);
const rgb = (r: number, g: number, b: number) => (chalk as any).rgb(r, g, b);
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * CyberPulse Auditor — ASCII Art Banner & Branding
 */

const BANNER = `
${chalk.bold.cyan('██████╗ ██████╗ ██████╗ ███████╗')}
${chalk.bold.cyan('██╔══██╗██╔══██╗██╔══██╗██╔════╝')}
${chalk.bold.cyan('██║  ██║██████╔╝██████╔╝███████╗')}
${chalk.bold.cyan('██║  ██║██╔══██╗██╔══██╗╚════██║')}
${chalk.bold.cyan('██████╔╝██║  ██║██║  ██║███████║')}
${chalk.bold.cyan('╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝')}
${chalk.cyan('██████╗ ███████╗███╗   ███╗██████╗ ██╗██╗     ███████╗███████╗')}
${chalk.cyan('██╔══██╗██╔════╝████╗ ████║██╔══██╗██║██║     ██╔════╝██╔════╝')}
${chalk.cyan('██║  ██║█████╗  ██╔████╔██║██████╔╝██║██║     █████╗  ███████╗')}
${chalk.cyan('██║  ██║██╔══╝  ██║╚██╔╝██║██╔═══╝ ██║██║     ██╔══╝  ╚════██║')}
${chalk.cyan('██████╔╝███████╗██║ ╚═╝ ██║██║     ██║███████╗███████╗███████║')}
${chalk.cyan('╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝')}`;

const SUBTITLE = `
${chalk.gray('━━━')} ${chalk.bold.white('Multi-Agent LLM Security Auditor')} ${chalk.gray('━━━')}
${chalk.gray('━━━')} ${chalk.cyan('OWASP LLM Top 10')} ${chalk.gray('━━━')} ${chalk.bold.red('Red Team')} `;

const VERSION = chalk.bold.gray('v0.1.0');

const TAGLINE = chalk.dim('  "Secure your AI, before it\'s too late."');

/** Divider line */
export const DIVIDER = chalk.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

export function printBanner(): void {
  console.log(BANNER);
  console.log(SUBTITLE);
  console.log(chalk.dim('  ──────────────────────────────────────────────────────────────'));
  console.log(
    `  ${VERSION}  ·  ${hex('#f97316')('[?]')} ${chalk.gray('cyberpulse --help for commands')}  ·  ` +
    `${chalk.green('✓')} ${chalk.gray('SQLite backend')}  ·  ${chalk.cyan('⚡')} ${chalk.gray('10 OWASP categories')}`
  );
  console.log(TAGLINE);
  console.log('');
}

/**
 * Print the interactive mode-selection menu.
 * Shown when `cyberpulse` is run with no subcommand.
 */
export function printInteractiveMenu(): void {
  console.log(BANNER);
  console.log(SUBTITLE);
  console.log(chalk.dim('  ──────────────────────────────────────────────────────────────'));
  console.log(
    `  ${VERSION}  ·  ${chalk.green('✓')} SQLite backend  ·  ${chalk.cyan('⚡')} 10 OWASP categories`
  );
  console.log(TAGLINE);
  console.log('');
  console.log(chalk.bold.white('  ┌─────────────────────────────────────────────────────────┐'));
  console.log(chalk.bold.white('  │            How would you like to proceed?                │'));
  console.log(chalk.bold.white('  └─────────────────────────────────────────────────────────┘'));
  console.log('');
  console.log(`  ${chalk.green('  [1]')}  ${chalk.bold.white('CLI Interactive Mode')}`);
  console.log(`       ${chalk.dim('Guided terminal wizard — pick targets, goals, and categories')}`);
  console.log('');
  console.log(`  ${chalk.cyan('  [2]')}  ${chalk.bold.white('Launch GUI Dashboard')}`);
  console.log(`       ${chalk.dim('Next.js web UI at http://localhost:3000 — visual reports & controls')}`);
  console.log('');
  console.log(`  ${chalk.gray('  [3]')}  ${chalk.bold.white('Direct Audit (CLI)')}`);
  console.log(`       ${chalk.dim('Run audit directly with flags — cyberpulse audit --help')}`);
  console.log('');
  console.log(chalk.dim('  ──────────────────────────────────────────────────────────────'));
  console.log(
    `  ${chalk.gray('Tip:')} ${chalk.dim('`cyberpulse gui`')} ${chalk.gray('to skip this menu and launch the GUI directly')
  }`);
  console.log('');
}

/** Status icons */
export const STATUS = {
  info:     chalk.cyan('    ℹ'),
  success:  chalk.green('    ✔'),
  warn:     hex('#f97316')('    ⚠'),
  error:    chalk.red('    ✖'),
  critical: chalk.bold.red('    ✖'),
  pending:  chalk.gray('    ◐'),
  running:  chalk.cyan('    ◉'),
  tick:     chalk.green('    ✓'),
  cross:    chalk.red('    ✗'),
} as const;

/** OWASP severity → chalk color function */
export const SEVERITY_COLOR: Record<string, (s: string) => string> = {
  critical: chalk.bold.red,
  high:     hex('#f97316'),
  medium:   hex('#eab308'),
  low:      chalk.green,
  info:     chalk.cyan,
};

/** OWASP category → chalk color function */
export const OWASP_COLOR: Record<string, (s: string) => string> = {
  LLM01: chalk.red,
  LLM02: hex('#f97316'),
  LLM03: hex('#eab308'),
  LLM04: chalk.green,
  LLM05: chalk.cyan,
  LLM06: chalk.blue,
  LLM07: hex('#a855f7'),
  LLM08: hex('#ec4899'),
  LLM09: chalk.gray,
  LLM10: chalk.white,
};
