import { spawn } from 'node:child_process';
import { logger } from '../../util/logger.js';
export class PythonFnTargetAdapter {
    id;
    module;
    func;
    timeout;
    constructor(config) {
        this.id = `python-fn:${config.pythonFn}`;
        const [mod, fn] = (config.pythonFn ?? '').split(':');
        this.module = mod ?? '';
        this.func = fn ?? 'call';
        this.timeout = config.timeout;
    }
    async ping() {
        // For python-fn, ping always succeeds if the interpreter is available
        return true;
    }
    async call(messages) {
        return new Promise((resolve, reject) => {
            const input = JSON.stringify({ messages });
            logger.debug('python-fn:target', `Calling ${this.module}.${this.func}`);
            const proc = spawn('python3', ['-c', `
import importlib, json, sys
mod = importlib.import_module('${this.module}')
fn = getattr(mod, '${this.func}')
inp = json.loads(sys.stdin.read())
print(json.dumps(fn(inp)))
`], { timeout: this.timeout, stdio: ['pipe', 'pipe', 'pipe'] });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('error', reject);
            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`python-fn exited ${code}: ${stderr}`));
                    return;
                }
                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(typeof result === 'string' ? result : JSON.stringify(result));
                }
                catch {
                    reject(new Error(`python-fn returned unparseable output: ${stdout}`));
                }
            });
            proc.stdin.write(input);
            proc.stdin.end();
        });
    }
}
//# sourceMappingURL=python-fn.js.map