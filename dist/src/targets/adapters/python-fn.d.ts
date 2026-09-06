import type { TargetAdapter, TargetConfig, TargetTurn } from '../types.js';
export declare class PythonFnTargetAdapter implements TargetAdapter {
    readonly id: string;
    private readonly module;
    private readonly func;
    private readonly timeout;
    constructor(config: TargetConfig);
    ping(): Promise<boolean>;
    call(messages: TargetTurn[]): Promise<string>;
}
