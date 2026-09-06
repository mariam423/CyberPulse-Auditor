import type { TargetAdapter, TargetConfig, TargetTurn } from '../types.js';
import { logger } from '../../util/logger.js';

export class HTTPTargetAdapter implements TargetAdapter {
  readonly id: string;
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;

  constructor(config: TargetConfig) {
    this.id = `http:${config.url}`;
    this.url = config.url!.replace(/\/$/, '');
    this.headers = config.headers ?? {};
    this.timeout = config.timeout;
  }

  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(this.url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(tid);
      return res.ok;
    } catch {
      return false;
    }
  }

  async call(messages: TargetTurn[]): Promise<string> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const lastMessage = messages.at(-1);

    const body: Record<string, unknown> = {
      prompt: lastMessage?.content ?? '',
    };

    if (systemMessages.length > 0) {
      (body as Record<string, unknown>).system = systemMessages.map((m) => m.content).join('\n');
    }

    logger.debug('http:target', `POST ${this.url} with ${messages.length} turns`);

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP target error ${response.status}: ${text}`);
    }

    const json: unknown = await response.json();
    if (typeof json === 'object' && json !== null && 'response' in json) {
      return String((json as Record<string, unknown>)['response']);
    }
    if (typeof json === 'string') return json;
    return JSON.stringify(json);
  }
}
