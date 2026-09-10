import chalk from 'chalk';

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

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SILENT = 99;

function resolveMinLevel(): number {
  if (process.env['CYBERPULSE_VERBOSE'] === '2') return LEVELS['debug'];
  if (process.env['CYBERPULSE_VERBOSE'] === '1') return LEVELS['info'];
  const raw = (process.env['CYBERPULSE_LOG_LEVEL'] ?? 'silent') as LogLevel | 'silent';
  if (raw === 'silent') return SILENT;
  return LEVELS[raw] ?? SILENT;
}

let minLevel = resolveMinLevel();

function setMinLevel(level: number): void {
  minLevel = level;
}

/** Programmatically raise verbosity (used by the --verbose / --debug CLI flags). */
export const logger = {
  enableVerbose(): void {
    setMinLevel(LEVELS['info']);
  },

  enableDebug(): void {
    setMinLevel(LEVELS['debug']);
  },

  isEnabled(level: LogLevel): boolean {
    return LEVELS[level] >= minLevel;
  },

  debug(component: string, message: string, meta?: unknown): void {
    if (LEVELS['debug'] >= minLevel) {
      process.stderr.write(`${format('debug', component, chalk.gray(message), meta)}\n`);
    }
  },

  info(component: string, message: string, meta?: unknown): void {
    if (LEVELS['info'] >= minLevel) {
      process.stderr.write(`${format('info', component, chalk.blue(message), meta)}\n`);
    }
  },

  warn(component: string, message: string, meta?: unknown): void {
    if (LEVELS['warn'] >= minLevel) {
      process.stderr.write(`${format('warn', component, chalk.yellow(message), meta)}\n`);
    }
  },

  error(component: string, message: string, err?: unknown): void {
    // Errors always surface (unless explicitly silenced) — they go to stderr.
    if (LEVELS['error'] >= minLevel) {
      const meta = err instanceof Error ? { message: err.message, stack: err.stack } : err;
      process.stderr.write(`${format('error', component, chalk.red(message), meta)}\n`);
    }
  },
};

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function formatMessage(level: LogLevel, component: string, message: string, meta?: unknown): string {
  const ts = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const comp = `[${component}]`.padEnd(20);
  const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${levelStr} ${comp} ${message}${metaStr}`;
}

function format(level: LogLevel, component: string, message: string, meta?: unknown): string {
  return formatMessage(level, component, message, meta);
}
