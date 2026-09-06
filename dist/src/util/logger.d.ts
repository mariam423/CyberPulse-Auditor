export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare const logger: {
    debug(component: string, message: string, meta?: unknown): void;
    info(component: string, message: string, meta?: unknown): void;
    warn(component: string, message: string, meta?: unknown): void;
    error(component: string, message: string, err?: unknown): void;
};
