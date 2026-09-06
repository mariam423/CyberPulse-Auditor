import { TargetConfigSchema } from './types.js';
import { HTTPTargetAdapter } from './adapters/http.js';
import { OpenAICompatibleTargetAdapter } from './adapters/openai-compatible.js';
import { PythonFnTargetAdapter } from './adapters/python-fn.js';
import { logger } from '../util/logger.js';
export { TargetConfigSchema } from './types.js';
export function createTargetAdapter(config) {
    const cfg = TargetConfigSchema.parse(config);
    logger.info('targets:adapter', `Creating target adapter: ${cfg.type}`);
    switch (cfg.type) {
        case 'http':
            if (!cfg.url)
                throw new Error('http target requires url');
            return new HTTPTargetAdapter(cfg);
        case 'openai-compatible':
            if (!cfg.url)
                throw new Error('openai-compatible target requires url');
            return new OpenAICompatibleTargetAdapter(cfg);
        case 'python-fn':
            if (!cfg.pythonFn)
                throw new Error('python-fn target requires pythonFn');
            return new PythonFnTargetAdapter(cfg);
        default:
            throw new Error(`Unknown target type: ${cfg.type}`);
    }
}
//# sourceMappingURL=adapter.js.map