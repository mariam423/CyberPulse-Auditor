import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const level = (process.env['CYBERPULSE_LOG_LEVEL'] ?? 'info') as LogLevel;
const minLevel = LEVELS[level] ?? 1;

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

export const logger = {
  debug(component: string, message: string, meta?: unknown): void {
    if (LEVELS['debug'] >= minLevel) {
      console.debug(formatMessage('debug', component, chalk.gray(message), meta));
    }
  },

  info(component: string, message: string, meta?: unknown): void {
    if (LEVELS['info'] >= minLevel) {
      console.info(formatMessage('info', component, chalk.blue(message), meta));
    }
  },

  warn(component: string, message: string, meta?: unknown): void {
    if (LEVELS['warn'] >= minLevel) {
      console.warn(formatMessage('warn', component, chalk.yellow(message), meta));
    }
  },

  error(component: string, message: string, err?: unknown): void {
    if (LEVELS['error'] >= minLevel) {
      const meta = err instanceof Error ? { message: err.message, stack: err.stack } : err;
      console.error(formatMessage('error', component, chalk.red(message), meta));
    }
  },
};
