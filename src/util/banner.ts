import chalk from 'chalk';

/* eslint-disable @typescript-eslint/no-explicit-any */
const hex = (c: string) => (chalk as any).hex(c);
const rgb = (r: number, g: number, b: number) => (chalk as any).rgb(r, g, b);
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * CyberPulse Auditor — Block ASCII Art Banner & Branding
 *
 * Rendered in ANSI Shadow (thick block/matrix font), inspired by
 * block-rendered tool titles like "BUGWOLF HUNTER". Zero runtime
 * dependencies — the glyphs are pre-rendered and shipped as data.
 */

const CYBERPULSE_ART: readonly string[] = [
  ' ██████╗██╗   ██╗██████╗ ███████╗██████╗ ██████╗ ██╗   ██╗██╗     ███████╗',
  '██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔══██╗██║   ██║██║     ██╔════╝',
  '██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝██████╔╝██║   ██║██║     ███████╗',
  '██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗██╔═══╝ ██║   ██║██║     ╚════██║',
  '╚██████╗   ██║   ██████╔╝███████╗██║  ██║██║     ╚██████╔╝███████╗███████║',
  ' ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝ ╚══════╝╚══════╝',
];

const AUDITOR_ART: readonly string[] = [
  ' █████╗ ██╗   ██╗██████╗ ██╗████████╗ ██████╗ ██████╗ ',
  '██╔══██╗██║   ██╗██╔══██╗██║╚══██╔══╝██╔═══██╗██╔══██╗',
  '███████║██║   ██║██║  ██╗██║   ██║   ██║   ██║██████╔╝',
  '██╔══██║██║   ██║██║  ██║██║   ██║   ██║   ██║██╔══██╗',
  '██║  ██║╚██████╔╝██████╔╝██║   ██║   ╚██████╔╝██║  ██║',
  '╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝',
];

/** Emerald → cyan gradient stops for the CYBERPULSE title. */
const TITLE_STOPS: Array<(s: string) => string> = [
  rgb(16, 185, 129),  // emerald-500
  rgb(20, 184, 166),  // teal-500
  rgb(34, 211, 238),  // cyan-400
  rgb(34, 211, 238),
  rgb(56, 189, 248),  // sky-400
  rgb(125, 211, 252), // sky-300
];

/** Render a pre-rendered block-art string array with a vertical color gradient. */
function gradient(lines: readonly string[], stops: Array<(s: string) => string>): string[] {
  return lines.map((line, i) => {
    const fn = stops[Math.min(Math.floor((i / lines.length) * stops.length), stops.length - 1)]!;
    return fn(line.replace(/\s+$/u, ''));
  });
}

/** Indent every line of a block by exactly two spaces (crisp alignment). */
function indent(lines: readonly string[], pad: string): string {
  return lines.map((l) => pad + l).join('\n');
}

const VERSION = 'v0.1.0';

function statusStrip(): string {
  return (
    `${chalk.bold.gray(VERSION)}` +
    `  ${chalk.dim('·')}  ${chalk.green('✔')} ${chalk.gray('SQLite backend')}` +
    `  ${chalk.dim('·')}  ${chalk.cyan('⚡')} ${chalk.gray('10 OWASP categories')}` +
    `  ${chalk.dim('·')}  ${chalk.bold.cyan('⌘')} ${chalk.gray('cyberpulse --help')}`
  );
}

const TAGLINE = chalk.italic.gray('  "Secure your AI, before it\'s too late."');

/** Wide divider used as section rules across the CLI. */
export const DIVIDER = chalk.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

/** Indented gradient banner block (re-exported so callers can print raw). */
export const BANNER =
  indent(gradient(CYBERPULSE_ART, TITLE_STOPS), '  ') +
  '\n' +
  indent(gradient(AUDITOR_ART, TITLE_STOPS), '  ');

/** Subtitle + status strip shown under the banner. */
function bannerChrome(interactive: boolean): string[] {
  const lines: string[] = [''];
  lines.push(`  ${chalk.gray('▔'.repeat(61))}`);
  lines.push(
    `  ${chalk.bold.white('Multi-Agent LLM Security Auditor')}  ${chalk.gray('·')}  ` +
    `${chalk.cyan('OWASP LLM Top 10')}  ${chalk.gray('·')}  ${chalk.bold.red('RED TEAM')}`
  );
  lines.push(`  ${chalk.gray('▔'.repeat(61))}`);
  lines.push(`  ${statusStrip()}`);
  lines.push(TAGLINE);
  lines.push('');
  if (interactive) lines.push('');
  return lines;
}

/** Print the flagship CYBERPULSE / AUDITOR block-art banner. */
export function printBanner(): void {
  console.log(BANNER);
  for (const line of bannerChrome(false)) console.log(line);
}

/**
 * Print the interactive mode-selection menu.
 * Shown when `cyberpulse` is run with no subcommand.
 */
export function printInteractiveMenu(): void {
  console.log(BANNER);
  for (const line of bannerChrome(true)) console.log(line);

  console.log(`  ${chalk.bold.cyan('◆')} ${chalk.bold.white('How would you like to proceed?')}`);
  console.log('');
  console.log(`  ${chalk.bold.green('  [1]')}   ${chalk.bold.white('CLI Interactive Mode')}`);
  console.log(`          ${chalk.dim('Guided terminal wizard — pick targets, goals, and categories')}`);
  console.log('');
  console.log(`  ${chalk.bold.cyan('  [2]')}   ${chalk.bold.white('GUI Dashboard')}`);
  console.log(`          ${chalk.dim('Web UI at http://localhost:3000 — visual reports & controls')}`);
  console.log('');
  console.log(`  ${chalk.bold.gray('  [3]')}   ${chalk.bold.white('Direct Audit (CLI)')}`);
  console.log(`          ${chalk.dim('Run audit directly with flags — cyberpulse audit --help')}`);
  console.log('');
  console.log(
    `  ${chalk.gray('Tip:')} ${chalk.dim('`cyberpulse gui`')} ${chalk.gray('launches the dashboard directly')}`
  );
  console.log('');
}

/** Status icons — inline width (callers own the indentation). */
export const STATUS = {
  info:     chalk.cyan('ℹ'),
  success:  chalk.green('✔'),
  warn:     hex('#f97316')('⚠'),
  error:    chalk.red('✖'),
  critical: chalk.bold.red('✖'),
  pending:  chalk.gray('○'),
  running:  chalk.cyan('◉'),
  tick:     chalk.green('✔'),
  cross:    chalk.red('✖'),
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
