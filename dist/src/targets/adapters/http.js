import { logger } from '../../util/logger.js';
export class HTTPTargetAdapter {
    id;
    url;
    headers;
    timeout;
    constructor(config) {
        this.id = `http:${config.url}`;
        this.url = config.url.replace(/\/$/, '');
        this.headers = config.headers ?? {};
        this.timeout = config.timeout;
    }
    async ping() {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), this.timeout);
            const res = await fetch(this.url, {
                method: 'HEAD',
                signal: controller.signal,
            });
            clearTimeout(tid);
            return res.ok;
        }
        catch {
            return false;
        }
    }
    async call(messages) {
        const systemMessages = messages.filter((m) => m.role === 'system');
        const lastMessage = messages.at(-1);
        const body = {
            prompt: lastMessage?.content ?? '',
        };
        if (systemMessages.length > 0) {
            body.system = systemMessages.map((m) => m.content).join('\n');
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
        const json = await response.json();
        if (typeof json === 'object' && json !== null && 'response' in json) {
            return String(json['response']);
        }
        if (typeof json === 'string')
            return json;
        return JSON.stringify(json);
    }
}
//# sourceMappingURL=http.js.map