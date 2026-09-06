import type { TargetAdapter, TargetConfig, TargetTurn } from '../types.js';
export declare class OpenAICompatibleTargetAdapter implements TargetAdapter {
    readonly id: string;
    private readonly url;
    private readonly headers;
    private readonly timeout;
    private readonly model;
    constructor(config: TargetConfig);
    ping(): Promise<boolean>;
    call(messages: TargetTurn[]): Promise<string>;
}
