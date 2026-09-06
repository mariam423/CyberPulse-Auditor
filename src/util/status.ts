import chalk from 'chalk';
import { STATUS, SEVERITY_COLOR, OWASP_COLOR, DIVIDER } from './banner.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const hex = (c: string) => (chalk as any).hex(c);
/* eslint-enable @typescript-eslint/no-explicit-any */

type StepStatus = 'pending' | 'running' | 'done' | 'skip' | 'fail';

export interface Step {
  label: string;
  status: StepStatus;
}

export class StepTracker {
  private readonly steps: Step[] = [];
  private current = 0;

  constructor(steps: string[]) {
    for (const label of steps) {
      this.steps.push({ label, status: 'pending' });
    }
  }

  start(label: string): void {
    const idx = this.steps.findIndex((s) => s.label === label);
    if (idx >= 0) {
      this.steps[idx]!.status = 'running';
      this.current = idx;
    }
  }

  done(label?: string): void {
    const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
    if (idx >= 0) this.steps[idx]!.status = 'done';
  }

  fail(label?: string): void {
    const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
    if (idx >= 0) this.steps[idx]!.status = 'fail';
  }

  skip(label?: string): void {
    const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
    if (idx >= 0) this.steps[idx]!.status = 'skip';
  }

  render(): void {
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
  info(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`${STATUS.info}  ${chalk.bold.cyan('INFO')}   ${msg}${metaStr}`);
  },

  success(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`${STATUS.success}  ${chalk.bold.green('SUCCESS')} ${msg}${metaStr}`);
  },

  warn(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`${STATUS.warn}  ${chalk.bold(hex('#f97316')('WARN'))}    ${msg}${metaStr}`);
  },

  error(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`${STATUS.error}  ${chalk.bold.red('ERROR')}  ${msg}${metaStr}`);
  },

  critical(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`${STATUS.critical}  ${chalk.bold.red('CRITICAL')} ${msg}${metaStr}`);
  },

  section(label: string): void {
    console.log('');
    console.log(DIVIDER);
    console.log(`  ${chalk.bold.cyan('▸')} ${chalk.bold.white(label)}`);
    console.log(DIVIDER);
    console.log('');
  },

  sub(label: string): void {
    console.log('');
    console.log(`  ${chalk.bold.gray('▸')} ${chalk.bold.gray(label)}`);
  },

  divider(): void {
    console.log(DIVIDER);
  },

  blank(): void {
    console.log('');
  },

  kv(key: string, value: string): void {
    const k = chalk.bold.gray(key.padEnd(14));
    console.log(`       ${k}  ${value}`);
  },

  findingRow(owaspId: string, severity: string, title: string, closed: boolean): void {
    const sevFn = SEVERITY_COLOR[severity] ?? chalk.gray;
    const owaspFn = OWASP_COLOR[owaspId] ?? chalk.white;
    const badge = sevFn(`[${severity.toUpperCase()}]`);
    const id = owaspFn(owaspId);
    const statusIcon = closed ? STATUS.tick : STATUS.cross;

    console.log(
      `  ${statusIcon}  ${badge}  ${chalk.bold(id)}  ${title}  ` +
      `${chalk.gray('→')} ${closed ? chalk.green('CLOSED') : chalk.red('OPEN')}`
    );
  },

  severityBar(severity: string, count: number, total: number): void {
    const sevFn = SEVERITY_COLOR[severity] ?? chalk.gray;
    const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, total - count));
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const displayBar = bar || '░'.repeat(1);
    console.log(
      `       ${sevFn(severity.toUpperCase().padEnd(10))}  ${sevFn(displayBar)}  ` +
      `${chalk.bold(sevFn(String(count)))}  (${pct}%)`
    );
  },

  owaspBanner(ids: string[]): void {
    const parts = ids.map((id) => {
      const fn = OWASP_COLOR[id] ?? chalk.white;
      return fn(id);
    });
    console.log('       ' + parts.join(chalk.gray('  ·  ')));
  },

  runMeta(rows: Array<[string, string]>): void {
    for (const [key, value] of rows) {
      this.kv(key, value);
    }
  },

  pulse(msg: string): void {
    process.stdout.write(`\r  ${STATUS.running}  ${chalk.cyan(msg)}`);
  },

  clearPulse(): void {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  },
};
