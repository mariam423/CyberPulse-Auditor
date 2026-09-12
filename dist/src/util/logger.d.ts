/**
 * CyberPulse structured logger.
 *
 * Silent-by-default: internal component chatter ([owasp:catalog],
 * [store:sqlite], payload lines, ...) NEVER pollutes normal CLI runs.
 *
 * Disclosure ladder (first match wins):
 *   1. --verbose / --debug CLI flag        → sets CYBERPULSE_VERBOSE=1 / =2
 *   2. CYBERPULSE_VERBOSE env var          → '1' (info+) or '2' (debug+)
 *   3. CYBERPULSE_LOG_LEVEL env var        → debug | info | warn | error | silent
 *   4. default                            → silent (errors only, stderr)
 *
 * All verbose output is written to STDERR so `cyberpulse report --format json`
 * can still be piped cleanly.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
/** Programmatically raise verbosity (used by the --verbose / --debug CLI flags). */
export declare const logger: {
    enableVerbose(): void;
    enableDebug(): void;
    isEnabled(level: LogLevel): boolean;
    debug(component: string, message: string, meta?: unknown): void;
    info(component: string, message: string, meta?: unknown): void;
    warn(component: string, message: string, meta?: unknown): void;
    error(component: string, message: string, err?: unknown): void;
};
