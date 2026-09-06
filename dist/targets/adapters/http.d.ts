import type { TargetAdapter, TargetConfig, TargetTurn } from '../types.js';
export declare class HTTPTargetAdapter implements TargetAdapter {
    readonly id: string;
    private readonly url;
    private readonly headers;
    private readonly timeout;
    constructor(config: TargetConfig);
    ping(): Promise<boolean>;
    call(messages: TargetTurn[]): Promise<string>;
}
