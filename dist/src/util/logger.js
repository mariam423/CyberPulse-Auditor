import chalk from 'chalk';
const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const SILENT = 99;
function resolveMinLevel() {
    if (process.env['CYBERPULSE_VERBOSE'] === '2')
        return LEVELS['debug'];
    if (process.env['CYBERPULSE_VERBOSE'] === '1')
        return LEVELS['info'];
    const raw = (process.env['CYBERPULSE_LOG_LEVEL'] ?? 'silent');
    if (raw === 'silent')
        return SILENT;
    return LEVELS[raw] ?? SILENT;
}
let minLevel = resolveMinLevel();
function setMinLevel(level) {
    minLevel = level;
}
/** Programmatically raise verbosity (used by the --verbose / --debug CLI flags). */
export const logger = {
    enableVerbose() {
        setMinLevel(LEVELS['info']);
    },
    enableDebug() {
        setMinLevel(LEVELS['debug']);
    },
    isEnabled(level) {
        return LEVELS[level] >= minLevel;
    },
    debug(component, message, meta) {
        if (LEVELS['debug'] >= minLevel) {
            process.stderr.write(`${format('debug', component, chalk.gray(message), meta)}\n`);
        }
    },
    info(component, message, meta) {
        if (LEVELS['info'] >= minLevel) {
            process.stderr.write(`${format('info', component, chalk.blue(message), meta)}\n`);
        }
    },
    warn(component, message, meta) {
        if (LEVELS['warn'] >= minLevel) {
            process.stderr.write(`${format('warn', component, chalk.yellow(message), meta)}\n`);
        }
    },
    error(component, message, err) {
        // Errors always surface (unless explicitly silenced) — they go to stderr.
        if (LEVELS['error'] >= minLevel) {
            const meta = err instanceof Error ? { message: err.message, stack: err.stack } : err;
            process.stderr.write(`${format('error', component, chalk.red(message), meta)}\n`);
        }
    },
};
function formatTimestamp() {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
}
function formatMessage(level, component, message, meta) {
    const ts = formatTimestamp();
    const levelStr = level.toUpperCase().padEnd(5);
    const comp = `[${component}]`.padEnd(20);
    const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${levelStr} ${comp} ${message}${metaStr}`;
}
function format(level, component, message, meta) {
    return formatMessage(level, component, message, meta);
}
//# sourceMappingURL=logger.js.map