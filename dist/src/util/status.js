import chalk from 'chalk';
import { STATUS, SEVERITY_COLOR, OWASP_COLOR, DIVIDER } from './banner.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
const hex = (c) => chalk.hex(c);
export class StepTracker {
    steps = [];
    current = 0;
    constructor(steps) {
        for (const label of steps) {
            this.steps.push({ label, status: 'pending' });
        }
    }
    start(label) {
        const idx = this.steps.findIndex((s) => s.label === label);
        if (idx >= 0) {
            this.steps[idx].status = 'running';
            this.current = idx;
        }
    }
    done(label) {
        const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
        if (idx >= 0)
            this.steps[idx].status = 'done';
    }
    fail(label) {
        const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
        if (idx >= 0)
            this.steps[idx].status = 'fail';
    }
    skip(label) {
        const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
        if (idx >= 0)
            this.steps[idx].status = 'skip';
    }
    render() {
        for (const step of this.steps) {
            const icon = step.status === 'done' ? STATUS.tick
                : step.status === 'fail' ? STATUS.cross
                    : step.status === 'skip' ? chalk.gray('    ○')
                        : step.status === 'running' ? STATUS.running
                            : STATUS.pending;
            const color = step.status === 'done' ? chalk.green
                : step.status === 'fail' ? chalk.red
                    : step.status === 'running' ? chalk.cyan
                        : chalk.gray;
            console.log(`  ${icon}  ${color(step.label)}`);
        }
    }
}
export const ui = {
    info(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`${STATUS.info}  ${chalk.bold.cyan('INFO')}   ${msg}${metaStr}`);
    },
    success(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`${STATUS.success}  ${chalk.bold.green('SUCCESS')} ${msg}${metaStr}`);
    },
    warn(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`${STATUS.warn}  ${chalk.bold(hex('#f97316')('WARN'))}    ${msg}${metaStr}`);
    },
    error(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`${STATUS.error}  ${chalk.bold.red('ERROR')}  ${msg}${metaStr}`);
    },
    critical(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`${STATUS.critical}  ${chalk.bold.red('CRITICAL')} ${msg}${metaStr}`);
    },
    section(label) {
        console.log('');
        console.log(DIVIDER);
        console.log(`  ${chalk.bold.cyan('▸')} ${chalk.bold.white(label)}`);
        console.log(DIVIDER);
        console.log('');
    },
    sub(label) {
        console.log('');
        console.log(`  ${chalk.bold.gray('▸')} ${chalk.bold.gray(label)}`);
    },
    divider() {
        console.log(DIVIDER);
    },
    blank() {
        console.log('');
    },
    kv(key, value) {
        const k = chalk.bold.gray(key.padEnd(14));
        console.log(`       ${k}  ${value}`);
    },
    findingRow(owaspId, severity, title, closed) {
        const sevFn = SEVERITY_COLOR[severity] ?? chalk.gray;
        const owaspFn = OWASP_COLOR[owaspId] ?? chalk.white;
        const badge = sevFn(`[${severity.toUpperCase()}]`);
        const id = owaspFn(owaspId);
        const statusIcon = closed ? STATUS.tick : STATUS.cross;
        console.log(`  ${statusIcon}  ${badge}  ${chalk.bold(id)}  ${title}  ` +
            `${chalk.gray('→')} ${closed ? chalk.green('CLOSED') : chalk.red('OPEN')}`);
    },
    severityBar(severity, count, total) {
        const sevFn = SEVERITY_COLOR[severity] ?? chalk.gray;
        const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, total - count));
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const displayBar = bar || '░'.repeat(1);
        console.log(`       ${sevFn(severity.toUpperCase().padEnd(10))}  ${sevFn(displayBar)}  ` +
            `${chalk.bold(sevFn(String(count)))}  (${pct}%)`);
    },
    owaspBanner(ids) {
        const parts = ids.map((id) => {
            const fn = OWASP_COLOR[id] ?? chalk.white;
            return fn(id);
        });
        console.log('       ' + parts.join(chalk.gray('  ·  ')));
    },
    runMeta(rows) {
        for (const [key, value] of rows) {
            this.kv(key, value);
        }
    },
    pulse(msg) {
        process.stdout.write(`\r  ${STATUS.running}  ${chalk.cyan(msg)}`);
    },
    clearPulse() {
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
    },
};
//# sourceMappingURL=status.js.map