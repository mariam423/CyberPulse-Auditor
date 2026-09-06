import { z } from 'zod';
import type { ModelClient, ModelConfig } from './types.js';
import { ModelConfigSchema } from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { logger } from '../util/logger.js';

export { ModelConfigSchema } from './types.js';
export type { ModelConfig, ModelClient } from './types.js';

export function createModelClient(config: unknown): ModelClient {
  const cfg = ModelConfigSchema.parse(config);
  logger.info('model:provider', `Creating model client for provider: ${cfg.provider}`);

  switch (cfg.provider) {
    case 'openai':
      return new OpenAIProvider(cfg);
    case 'anthropic':
      // TODO(Phase 2): implement Anthropic provider
      throw new Error(`Anthropic provider not yet implemented`);
    case 'ollama':
      // TODO(Phase 2): implement Ollama provider
      throw new Error(`Ollama provider not yet implemented`);
    default:
      throw new Error(`Unknown model provider: ${(cfg as ModelConfig).provider}`);
  }
}
