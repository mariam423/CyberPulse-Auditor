import chalk from 'chalk';
import { STATUS, SEVERITY_COLOR, OWASP_COLOR, DIVIDER } from './banner.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
const hex = (c) => chalk.hex(c);
/* eslint-enable @typescript-eslint/no-explicit-any */
/**
 * CyberPulse CLI — Silent Execution UX
 *
 * Braille spinners, live step tickers, and concise status lines replace
 * log spam. Nothing is printed unless it earns the pixels.
 */
// ── Spinner ───────────────────────────────────────────────────────────────────
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;
/** A single terminal spinner bound to one line of output. */
export class Spinner {
    frame = 0;
    timer = null;
    state = 'running';
    message;
    stream;
    quiet;
    /** Animating is pointless (and messy) when stdout is piped — stamp static lines instead. */
    animated;
    constructor(message, opts) {
        this.message = message;
        this.stream = opts?.stream ?? process.stdout;
        this.quiet = opts?.quiet ?? false;
        this.animated = this.stream.isTTY === true;
        if (!this.quiet)
            this.start();
    }
    render() {
        const glyph = chalk.cyan(FRAMES[this.frame % FRAMES.length]);
        this.stream.write(`\r  ${glyph}  ${chalk.bold.white(this.message)}`);
    }
    start() {
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
    clearLine() {
        if (!this.animated)
            return;
        this.stream.write('\r' + ' '.repeat(Math.max(this.message.length + 10, 40)) + '\r');
    }
    /** Overwrite the static non-TTY line in-place before stamping the result. */
    resetLine() {
        if (this.animated)
            return;
        this.stream.write('\r' + ' '.repeat(Math.max(this.message.length + 10, 40)) + '\r');
    }
    /** Replace the spinner message in-place (e.g. phase updates). */
    update(message) {
        if (this.state !== 'running')
            return;
        this.message = message;
        if (this.quiet || !this.animated)
            return;
        this.frame += 1;
        this.render();
    }
    finish(state, text) {
        if (this.state !== 'running')
            return;
        this.state = state;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.quiet)
            return;
        this.clearLine();
        this.resetLine();
        const label = text ?? this.message;
        const line = state === 'done'
            ? `  ${chalk.green('✔')}  ${label}`
            : state === 'fail'
                ? `  ${chalk.red('✖')}  ${label}`
                : `  ${chalk.gray('○')}  ${label}`;
        this.stream.write(line + '\n');
    }
    succeed(text) {
        this.finish('done', text);
    }
    fail(text) {
        this.finish('fail', text);
    }
    skip(text) {
        this.finish('skip', text);
    }
}
/** Convenience: spin while a promise settles. */
export async function withSpinner(message, fn) {
    const spinner = new Spinner(message);
    try {
        const result = await fn(spinner);
        spinner.succeed();
        return result;
    }
    catch (err) {
        spinner.fail();
        throw err;
    }
}
const ICONS = {
    pending: chalk.gray('○'),
    running: chalk.cyan('◉'),
    done: chalk.green('✔'),
    skip: chalk.gray('○'),
    fail: chalk.red('✖'),
};
const COLORS = {
    pending: chalk.gray,
    running: chalk.bold.cyan,
    done: chalk.green,
    skip: chalk.gray,
    fail: chalk.red,
};
/**
 * Live step ticker: renders a single spinner line for the active step and
 * stamps each finished step into the scrollback with a concise ✔ line.
 */
export class StepTracker {
    steps = [];
    current = 0;
    spinner;
    interactive;
    spinnerStream;
    constructor(steps, opts) {
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
    stamp(step, suffix = '') {
        if (!this.interactive)
            return;
        const stream = this.spinnerStream;
        if (stream)
            stream.write(`  ${ICONS[step.status]}  ${COLORS[step.status](step.label)}${suffix}\n`);
        else
            process.stdout.write(`  ${ICONS[step.status]}  ${COLORS[step.status](step.label)}${suffix}\n`);
    }
    start(label) {
        const idx = this.steps.findIndex((s) => s.label === label);
        if (idx >= 0) {
            this.current = idx;
            this.steps[idx].status = 'running';
            this.spinner.update(label);
        }
    }
    done(label, suffix) {
        const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
        const step = idx >= 0 ? this.steps[idx] : undefined;
        if (step && step.status !== 'done' && step.status !== 'fail') {
            step.status = 'done';
            this.stamp(step, suffix);
        }
    }
    /** Mark done with a summary suffix (e.g. `Target Analyzed (0 findings)`). */
    doneWith(label, suffix) {
        this.done(label, chalk.gray(` (${suffix})`));
    }
    fail(label) {
        const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
        const step = idx >= 0 ? this.steps[idx] : undefined;
        if (step) {
            step.status = 'fail';
            this.stamp(step);
        }
    }
    skip(label) {
        const idx = label ? this.steps.findIndex((s) => s.label === label) : this.current;
        const step = idx >= 0 ? this.steps[idx] : undefined;
        if (step) {
            step.status = 'skip';
            this.stamp(step);
        }
    }
    stopSpinner() {
        this.spinner.succeed();
    }
    /** Full summary render (used at the end of a run). */
    render() {
        for (const step of this.steps) {
            process.stdout.write(`  ${ICONS[step.status]}  ${COLORS[step.status](step.label)}\n`);
        }
    }
}
// ── Concise UI helpers ──────────────────────────────────────────────────────────
export const ui = {
    info(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`  ${STATUS.info}  ${chalk.bold.cyan('INFO')}   ${msg}${metaStr}`);
    },
    success(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`  ${STATUS.success}  ${chalk.bold.green('OK')}     ${msg}${metaStr}`);
    },
    warn(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`  ${STATUS.warn}  ${chalk.bold(hex('#f97316')('WARN'))}   ${msg}${metaStr}`);
    },
    error(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`  ${STATUS.error}  ${chalk.bold.red('ERROR')}  ${msg}${metaStr}`);
    },
    critical(msg, meta) {
        const metaStr = meta ? chalk.gray(` ${JSON.stringify(meta)}`) : '';
        console.log(`  ${STATUS.critical}  ${chalk.bold.red('CRIT')}   ${msg}${metaStr}`);
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
        const k = chalk.bold.gray(key.padEnd(12));
        console.log(`  ${k}  ${value}`);
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
        const displayBar = bar || '░';
        console.log(`  ${sevFn(severity.toUpperCase().padEnd(9))}  ${sevFn(displayBar)}  ` +
            `${chalk.bold(sevFn(String(count)))}  (${pct}%)`);
    },
    owaspBanner(ids) {
        const parts = ids.map((id) => (OWASP_COLOR[id] ?? chalk.white)(id));
        console.log('  ' + parts.join(chalk.gray(' · ')));
    },
    runMeta(rows) {
        for (const [key, value] of rows) {
            this.kv(key, value);
        }
    },
    /** Spinner-bound transient pulse line. */
    pulse(msg) {
        const glyph = chalk.cyan('⠋');
        process.stdout.write(`\r  ${glyph}  ${chalk.cyan(msg)}`);
    },
    clearPulse() {
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
    },
};
//# sourceMappingURL=status.js.map