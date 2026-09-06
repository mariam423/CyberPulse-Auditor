import chalk from 'chalk';
/* eslint-disable @typescript-eslint/no-explicit-any */
const hex = (c) => chalk.hex(c);
const rgb = (r, g, b) => chalk.rgb(r, g, b);
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
export function printBanner() {
    console.log(BANNER);
    console.log(SUBTITLE);
    console.log(chalk.dim('  ──────────────────────────────────────────────────────────────'));
    console.log(`  ${VERSION}  ·  ${hex('#f97316')('[?]')} ${chalk.gray('cyberpulse --help for commands')}  ·  ` +
        `${chalk.green('✓')} ${chalk.gray('SQLite backend')}  ·  ${chalk.cyan('⚡')} ${chalk.gray('10 OWASP categories')}`);
    console.log(TAGLINE);
    console.log('');
}
/** Status icons */
export const STATUS = {
    info: chalk.cyan('    ℹ'),
    success: chalk.green('    ✔'),
    warn: hex('#f97316')('    ⚠'),
    error: chalk.red('    ✖'),
    critical: chalk.bold.red('    ✖'),
    pending: chalk.gray('    ◐'),
    running: chalk.cyan('    ◉'),
    tick: chalk.green('    ✓'),
    cross: chalk.red('    ✗'),
};
/** OWASP severity → chalk color function */
export const SEVERITY_COLOR = {
    critical: chalk.bold.red,
    high: hex('#f97316'),
    medium: hex('#eab308'),
    low: chalk.green,
    info: chalk.cyan,
};
/** OWASP category → chalk color function */
export const OWASP_COLOR = {
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
//# sourceMappingURL=banner.js.map