import chalk from 'chalk';
import { STATUS, SEVERITY_COLOR, OWASP_COLOR, DIVIDER } from './banner.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const hex = (c: string) => (chalk as any).hex(c);
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * CyberPulse CLI — Silent Execution UX
 *
 * Braille spinners, live step tickers, and concise status lines replace
 * log spam. Nothing is printed unless it earns the pixels.
 */

// ── Spinner ───────────────────────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
const INTERVAL_MS = 80;

type SpinnerState = 'running' | 'done' | 'fail' | 'skip';

/** A single terminal spinner bound to one line of output. */
export class Spinner {
  private frame = 0;
  private timer: NodeJS.Timeout | null = null;
  private state: SpinnerState = 'running';
  private message: string;
  private readonly stream: NodeJS.WriteStream;
  private readonly quiet: boolean;
  /** Animating is pointless (and messy) when stdout is piped — stamp static lines instead. */
  private readonly animated: boolean;

  constructor(message: string, opts?: { stream?: NodeJS.WriteStream; quiet?: boolean }) {
    this.message = message;
    this.stream = opts?.stream ?? process.stdout;
    this.quiet = opts?.quiet ?? false;
    this.animated = this.stream.isTTY === true;
    if (!this.quiet) this.start();
  }

  private render(): void {
    const glyph = chalk.cyan(FRAMES[this.frame % FRAMES.length]!);
    this.stream.write(`\r  ${glyph}  ${chalk.bold.white(this.message)}`);
  }

  private start(): void {
    if (!this.animated) {
      // Non-TTY (pipe/CI): no output until the result line — fully clean pipes.
      return;
    }
    this.render();
    this.timer = setInterval(() => {
      this.frame += 1;
      this.render();
    }, INTERVAL_MS);
    // Never keep the event loop alive just for cosmetics.
    this.timer.unref?.();
  }

  private clearLine(): void {
    if (!this.animated) return;
    this.stream.write('\r' + ' '.repeat(Math.max(this.message.length + 10, 40)) + '\r');
  }

  /** Overwrite the static non-TTY line in-place before stamping the result. */
  private resetLine(): void {
    if (this.animated) return;
    this.stream.write('\r' + ' '.repeat(Math.max(this.message.length + 10, 40)) + '\r');
  }

  /** Replace the spinner message in-place (e.g. phase updates). */
  update(message: string): void {
    if (this.state !== 'running') return;
    this.message = message;
    if (this.quiet || !this.animated) return;
    this.frame += 1;
    this.render();
  }

  private finish(state: SpinnerState, text?: string): void {
    if (this.state !== 'running') return;
    this.state = state;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.quiet) return;
    this.clearLine();
    this.resetLine();
    const label = text ?? this.message;
    const line =
      state === 'done'
        ? `  ${chalk.green('✔')}  ${label}`
        : state === 'fail'
        ? `  ${chalk.red('✖')}  ${label}`
        : `  ${chalk.gray('○')}  ${label}`;
    this.stream.write(line + '\n');
  }

  succeed(text?: string): void {
    this.finish('done', text);
  }

  fail(text?: string): void {
    this.finish('fail', text);
  }

  skip(text?: string): void {
    this.finish('skip', text);
  }
}

/** Convenience: spin while a promise settles. */
export async function withSpinner<T>(
  message: string,
  fn: (spinner: Spinner) => Promise<T>
): Promise<T> {
  const spinner = new Spinner(message);
  try {
    const result = await fn(spinner);
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail();
    throw err;
  }
}

// ── StepTracker ────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'skip' | 'fail';

export interface Step {
  label: string;
  status: StepStatus;
}

const ICONS: Record<StepStatus, string> = {
  pending: chalk.gray('○'),
  running: chalk.cyan('◉'),
  done:    chalk.green('✔'),
  skip:    chalk.gray('○'),
  fail:    chalk.red('✖'),
};

const COLORS: Record<StepStatus, (s: string) => string> = {
  pending: chalk.gray,
  running: chalk.bold.cyan,
  done:    chalk.green,
  skip:    chalk.gray,
  fail:    chalk.red,
};

/**
 * Live step ticker: renders a single spinner line for the active step and
 * stamps each finished step into the scrollback with a concise ✔ line.
 */
export class StepTracker {
  private readonly steps: Step[] = [];
  private current = 0;
  private readonly spinner: Spinner;
  private readonly interactive: boolean;
  private readonly spinnerStream: NodeJS.WriteStream | undefined;

  constructor(steps: string[], opts?: { interactive?: boolean; stream?: NodeJS.WriteStream }) {
    for (const label of steps) {
      this.steps.push({ label, status: 'pending' });
    }
    this.interactive = opts?.interactive ?? true;
    this.spinnerStream = opts?.stream;
    this.spinner = new Spinner(steps[0] ?? 'Working', {
      ...(opts?.stream ? { stream: opts.stream } : {}),
      quiet: !this.interactive,
    });
  }

  private stamp(step: Step, suffix = ''): void {
    if (!this.interactive) return;
    const stream = this.spinnerStream;
    if (stream) stream.write(`  ${ICONS[step.status]!}  ${COLORS[step.status]!(step.label)}${suffix}\n`);
    else process.stdout.write(`  ${ICONS[step.status]!}  ${COLORS[step.status]!(step.label)}${suffix}\n`);
  }

  start(label: string): void {
    const idx = this.steps.findIndex((s) => s.label === label);
    if (idx >= 0) {
      this.current = idx;
      this.steps[idx]!.status = 'running';
      this.spinner.update(label);
    }
  }

  done(label?: string, suffix?: string): void {
    const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
    const step = idx >= 0 ? this.steps[idx] : undefined;
    if (step && step.status !== 'done' && step.status !== 'fail') {
      step.status = 'done';
      this.stamp(step, suffix);
    }
  }

  /** Mark done with a summary suffix (e.g. `Target Analyzed (0 findings)`). */
  doneWith(label: string, suffix: string): void {
    this.done(label, chalk.gray(` (${suffix})`));
  }

  fail(label?: string): void {
    const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
    const step = idx >= 0 ? this.steps[idx] : undefined;
    if (step) {
      step.status = 'fail';
      this.stamp(step);
    }
  }

  skip(label?: string): void {
    const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
    const step = idx >= 0 ? this.steps[idx] : undefined;
    if (step) {
      step.status = 'skip';
      this.stamp(step);
    }
  }

  stopSpinner(): void {
    this.spinner.succeed();
  }

  /** Full summary render (used at the end of a run). */
  render(): void {
    for (const step of this.steps) {
      process.stdout.write(`  ${ICONS[step.status]!}  ${COLORS[step.status]!(step.label)}\n`);
    }
  }
}

// ── Concise UI helpers ──────────────────────────────────────────────────────────

export const ui = {
  info(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`  ${STATUS.info}  ${chalk.bold.cyan('INFO')}   ${msg}${metaStr}`);
  },

  success(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`  ${STATUS.success}  ${chalk.bold.green('OK')}     ${msg}${metaStr}`);
  },

  warn(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`  ${STATUS.warn}  ${chalk.bold(hex('#f97316')('WARN'))}   ${msg}${metaStr}`);
  },

  error(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`  ${STATUS.error}  ${chalk.bold.red('ERROR')}  ${msg}${metaStr}`);
  },

  critical(msg: string, meta?: Record<string, unknown>): void {
    const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
    console.log(`  ${STATUS.critical}  ${chalk.bold.red('CRIT')}   ${msg}${metaStr}`);
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
    const k = chalk.bold.gray(key.padEnd(12));
    console.log(`  ${k}  ${value}`);
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
    const displayBar = bar || '░';
    console.log(
      `  ${sevFn(severity.toUpperCase().padEnd(9))}  ${sevFn(displayBar)}  ` +
      `${chalk.bold(sevFn(String(count)))}  (${pct}%)`
    );
  },

  owaspBanner(ids: string[]): void {
    const parts = ids.map((id) => (OWASP_COLOR[id] ?? chalk.white)(id));
    console.log('  ' + parts.join(chalk.gray(' · ')));
  },

  runMeta(rows: Array<[string, string]>): void {
    for (const [key, value] of rows) {
      this.kv(key, value);
    }
  },

  /** Spinner-bound transient pulse line. */
  pulse(msg: string): void {
    const glyph = chalk.cyan('⠋');
    process.stdout.write(`\r  ${glyph}  ${chalk.cyan(msg)}`);
  },

  clearPulse(): void {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  },
};
