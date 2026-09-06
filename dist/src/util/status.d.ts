type StepStatus = 'pending' | 'running' | 'done' | 'skip' | 'fail';
export interface Step {
    label: string;
    status: StepStatus;
}
export declare class StepTracker {
    private readonly steps;
    private current;
    constructor(steps: string[]);
    start(label: string): void;
    done(label?: string): void;
    fail(label?: string): void;
    skip(label?: string): void;
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
    pulse(msg: string): void;
    clearPulse(): void;
};
export {};
