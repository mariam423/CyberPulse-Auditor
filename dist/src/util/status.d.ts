/**
 * CyberPulse CLI — Silent Execution UX
 *
 * Braille spinners, live step tickers, and concise status lines replace
 * log spam. Nothing is printed unless it earns the pixels.
 *
 * STREAM CONTRACT: every human-facing UX line (sections, step stamps,
 * spinners, kv rows) flows through uxWrite/uxOut. When stdout is piped —
 * `cyberpulse audit --output json | jq` — the pipeline output must stay
 * parse-clean, so ALL progress chrome reroutes to stderr automatically.
 * Machine data (reports) keeps stdout; humans get their UX intact.
 */
/**
 * UX stream router: stderr when stdout is a pipe, stdout when interactive.
 * Forces (CYBERPULSE_UX_STDOUT=1) are honored for embedding contexts.
 */
export declare function uxOut(): NodeJS.WriteStream;
/** Write one human UX line (with newline) through the stream router. */
export declare function uxWrite(line: string): void;
/** A single terminal spinner bound to one line of output. */
export declare class Spinner {
    private frame;
    private timer;
    private state;
    private message;
    private readonly stream;
    private readonly quiet;
    /** Animating is pointless (and messy) when stdout is piped — stamp static lines instead. */
    private readonly animated;
    constructor(message: string, opts?: {
        stream?: NodeJS.WriteStream;
        quiet?: boolean;
    });
    private render;
    private start;
    private clearLine;
    /** Overwrite the static non-TTY line in-place before stamping the result. */
    private resetLine;
    /** Replace the spinner message in-place (e.g. phase updates). */
    update(message: string): void;
    private finish;
    succeed(text?: string): void;
    fail(text?: string): void;
    skip(text?: string): void;
}
/** Convenience: spin while a promise settles. */
export declare function withSpinner<T>(message: string, fn: (spinner: Spinner) => Promise<T>): Promise<T>;
type StepStatus = 'pending' | 'running' | 'done' | 'skip' | 'fail';
export interface Step {
    label: string;
    status: StepStatus;
}
/**
 * Live step ticker: renders a single spinner line for the active step and
 * stamps each finished step into the scrollback with a concise ✔ line.
 */
export declare class StepTracker {
    private readonly steps;
    private current;
    private readonly spinner;
    private readonly interactive;
    private readonly spinnerStream;
    constructor(steps: string[], opts?: {
        interactive?: boolean;
        stream?: NodeJS.WriteStream;
    });
    private stamp;
    start(label: string): void;
    done(label?: string, suffix?: string): void;
    /** Mark done with a summary suffix (e.g. `Target Analyzed (0 findings)`). */
    doneWith(label: string, suffix: string): void;
    fail(label?: string): void;
    skip(label?: string): void;
    stopSpinner(): void;
    /** Full summary render (used at the end of a run). */
    render(): void;
}
export declare const ui: {
    info(msg: string, meta?: Record<string, unknown>): void;
    success(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
    error(msg: string, meta?: Record<string, unknown>): void;
    critical(msg: string, meta?: Record<string, unknown>): void;
    section(label: string): void;
    sub(label: string): void;
    divider(): void;
    blank(): void;
    kv(key: string, value: string): void;
    findingRow(owaspId: string, severity: string, title: string, closed: boolean): void;
    severityBar(severity: string, count: number, total: number): void;
    owaspBanner(ids: string[]): void;
    runMeta(rows: Array<[string, string]>): void;
    /** Spinner-bound transient pulse line. */
    pulse(msg: string): void;
    clearPulse(): void;
};
export {};
