import { spawn } from 'node:child_process';
import type { TargetAdapter, TargetConfig, TargetTurn } from '../types.js';
import { logger } from '../../util/logger.js';

/**
 * Whitelist for module/function identifiers. The python-fn adapter used to
 * interpolate `mod:fn` directly into a `python3 -c` script — an attacker
 * controlling `--target-python-fn` (CLI flag, GUI scan form, stored run
 * descriptor) could inject arbitrary Python (confirmed RCE). Identifiers
 * now MUST match a strict charset, and are additionally passed via stdin
 * as data (never interpolated into code).
 */
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function assertIdentifier(kind: string, value: string): void {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(
      `Invalid python-fn ${kind}: ${JSON.stringify(value).slice(0, 80)} — ` +
      `only [A-Za-z0-9_.] identifiers are allowed`
    );
  }
}

export class PythonFnTargetAdapter implements TargetAdapter {
  readonly id: string;
  private readonly module: string;
  private readonly func: string;
  private readonly timeout: number;

  constructor(config: TargetConfig) {
    this.id = `python-fn:${config.pythonFn}`;
    const [mod, fn] = (config.pythonFn ?? '').split(':');
    this.module = mod ?? '';
    this.func = fn ?? 'call';
    // Fail fast — an invalid identifier never reaches the interpreter.
    assertIdentifier('module', this.module);
    assertIdentifier('function', this.func);
    this.timeout = config.timeout;
  }

  async ping(): Promise<boolean> {
    // For python-fn, ping always succeeds if the interpreter is available
    return true;
  }

  async call(messages: TargetTurn[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // The bootstrap script is STATIC — module/function names travel as
      // stdin JSON (data), so no user input can ever become code.
      const proc = spawn('python3', ['-c', `
import importlib, json, sys
spec = json.loads(sys.stdin.read())
mod = importlib.import_module(spec["module"])
fn = getattr(mod, spec["function"])
print(json.dumps(fn(spec["input"])))
`], { timeout: this.timeout, stdio: ['pipe', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      proc.stdout!.on('data', (d) => { stdout += d.toString(); });
      proc.stderr!.on('data', (d) => { stderr += d.toString(); });

      proc.on('error', reject);

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`python-fn exited ${code}: ${stderr}`));
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          resolve(typeof result === 'string' ? result : JSON.stringify(result));
        } catch {
          reject(new Error(`python-fn returned unparseable output: ${stdout}`));
        }
      });

      logger.debug('python-fn:target', `Calling ${this.module}.${this.func}`);
      const payload = JSON.stringify({
        module: this.module,
        function: this.func,
        input: { messages },
      });
      proc.stdin!.write(payload);
      proc.stdin!.end();
    });
  }
}
