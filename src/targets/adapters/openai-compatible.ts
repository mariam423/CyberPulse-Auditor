import type { TargetAdapter, TargetConfig, TargetTurn } from '../types.js';
import { ChatCompletionRequestSchema, ChatCompletionResponseSchema } from '../../model/types.js';
import { logger } from '../../util/logger.js';

export class OpenAICompatibleTargetAdapter implements TargetAdapter {
  readonly id: string;
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;
  private readonly model: string;

  constructor(config: TargetConfig) {
    this.id = `openai:${config.url}`;
    this.url = `${config.url!.replace(/\/$/, '')}/chat/completions`;
    this.headers = {
      'Content-Type': 'application/json',
      ...(config.headers ?? {}),
    };
    this.timeout = config.timeout;
    this.model = 'target-model'; // override via config if needed
  }

  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(this.url.replace('/chat/completions', '/models'), {
        signal: controller.signal,
      });
      clearTimeout(tid);
      return res.ok;
    } catch {
      return false;
    }
  }

  async call(messages: TargetTurn[]): Promise<string> {
    const apiKey = process.env['OPENAI_API_KEY'] ?? 'Bearer';

    const body = ChatCompletionRequestSchema.parse({
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
    });

    logger.debug('openai-compatible:target', `POST ${this.url}`);

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        ...this.headers,
        Authorization: apiKey.startsWith('Bearer') ? apiKey : `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI-compatible target error ${response.status}: ${text}`);
    }

    const json: unknown = await response.json();
    const parsed = ChatCompletionResponseSchema.parse(json);
    const firstChoice = parsed.choices[0];
    return firstChoice ? firstChoice.message.content : '';
  }
}
