/**
 * CyberPulse CLI — Interactive Scan Wizard
 *
 * A guided terminal wizard that walks the user through all options
 * before launching the audit. Fully parity with the GUI scan form.
 */

import * as readline from 'node:readline';
import chalk from 'chalk';
import { printBanner, OWASP_COLOR } from '../util/banner.js';
import { runAudit } from '../core/orchestrator.js';
import type { AuditConfig, OwaspId } from '../core/types.js';
import type { AuditOptions } from './program.js';

const rl = () =>
  readline.createInterface({ input: process.stdin, output: process.stdout });

/** Ask the user to pick one of a list of options. */
async function pick<T extends string>(
  prompt: string,
  options: readonly T[],
  labels?: Record<T, string>
): Promise<T> {
  console.log(`\n${chalk.bold.cyan(prompt)}`);
  options.forEach((opt) => {
    const idx = options.indexOf(opt) + 1;
    const label = (labels?.[opt] ?? opt).padEnd(28);
    console.log(`  ${chalk.white(String(idx).padStart(2))}. ${label}`);
  });

  const q = rl();
  return new Promise<T>((resolve) => {
    q.question(chalk.gray('\n  Your choice: '), (answer) => {
      q.close();
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx] as T);
      } else {
        console.log(chalk.yellow(`  Invalid — defaulting to "${options[0]}"`));
        resolve(options[0] as T);
      }
    });
  });
}

/** Free-text input. */
async function input(prompt: string, fallback: string): Promise<string> {
  console.log(chalk.bold.cyan(`\n${prompt}`));
  if (fallback) console.log(chalk.dim(`  [Enter] = "${fallback}"`));

  return new Promise<string>((resolve) => {
    const q = rl();
    q.question(chalk.gray('  > '), (answer) => {
      q.close();
      resolve(answer.trim() || fallback);
    });
  });
}

/** Yes/no confirmation. */
async function confirm(prompt: string, def = false): Promise<boolean> {
  const yn = def ? '[Y/n]' : '[y/N]';
  return new Promise<boolean>((resolve) => {
    const q = rl();
    q.question(chalk.gray(`  ${prompt} ${yn}: `), (answer) => {
      q.close();
      if (!answer.trim()) resolve(def);
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/** Multi-select OWASP categories. */
async function selectOwasp(): Promise<string[]> {
  const cats = [
    { id: 'LLM01', label: 'Prompt Injection' },
    { id: 'LLM02', label: 'Insecure Output Handling' },
    { id: 'LLM03', label: 'Training Data Poisoning' },
    { id: 'LLM04', label: 'Model Denial of Service' },
    { id: 'LLM05', label: 'Supply Chain Vulnerabilities' },
    { id: 'LLM06', label: 'Excessive Agency' },
    { id: 'LLM07', label: 'System Prompt Leakage' },
    { id: 'LLM08', label: 'Embedding Weaknesses' },
    { id: 'LLM09', label: 'Misinformation' },
    { id: 'LLM10', label: 'Model Theft' },
  ];

  console.log(chalk.bold.cyan('\n  Select OWASP categories to probe (space-separated, Enter = all):'));
  cats.forEach((c, i) => {
    const colorFn = OWASP_COLOR[c.id] ?? chalk.white;
    console.log(`    ${chalk.white(String(i + 1).padStart(2))}. ${colorFn(c.id)}  ${c.label}`);
  });

  return new Promise<OwaspId[]>((resolve) => {
    const q = rl();
    q.question(chalk.gray('\n  Categories (e.g. 1 3 5, or Enter for all): '), (answer) => {
      q.close();
      if (!answer.trim()) {
        resolve(cats.map((c) => c.id as OwaspId));
        return;
      }
      const selected = answer
        .split(/[\s,]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => n >= 1 && n <= cats.length)
        .map((n) => cats[n - 1]!.id as OwaspId);
      resolve(selected.length > 0 ? selected : cats.map((c) => c.id as OwaspId));
    });
  });
}

const MODEL_CHOICES = ['openai', 'anthropic', 'ollama'] as const;
const TARGET_TYPES = ['http', 'openai-compatible', 'python-fn'] as const;

/**
 * Run the full interactive wizard and execute the audit.
 */
export async function runInteractive(): Promise<void> {
  console.clear();
  printBanner();

  console.log(chalk.bold.white('\n  ┌─────────────────────────────────────────────────────────┐'));
  console.log(chalk.bold.white('  │          CyberPulse Interactive Scan Wizard              │'));
  console.log(chalk.bold.white('  └─────────────────────────────────────────────────────────┘'));
  console.log(chalk.dim('  Answer the prompts below to configure your security audit.\n'));

  // 1. Security Goal
  const goal = await input(
    '1. Security Goal',
    'Probe for prompt injection, excessive agency, and system prompt leakage vulnerabilities'
  );

  // 2. Target Type
  const targetType = await pick(
    '2. Target Type',
    TARGET_TYPES,
    {
      http: '🌐  HTTP API (e.g. OpenAI-compatible endpoint)',
      'openai-compatible': '🔑  OpenAI Compatible API',
      'python-fn': '🐍  Python Function (direct function call)',
    }
  );

  // 3. Target URL / Python fn
  let targetUrl = '';
  let pythonFn = '';
  if (targetType === 'http' || targetType === 'openai-compatible') {
    targetUrl = await input('3. Target URL', 'https://api.openai.com/v1/chat/completions');
  } else {
    pythonFn = await input('3. Python function (module:function)', 'mymodule:my_handler');
  }

  // 4. Model Provider
  const modelProvider = await pick('4. Model Provider', MODEL_CHOICES, {
    openai: '🤖  OpenAI (gpt-4o)',
    anthropic: '🧠  Anthropic (claude-3-5-sonnet)',
    ollama: '🦙  Ollama (local)',
  });

  const modelName =
    modelProvider === 'openai'
      ? await input('5. Model name (Enter = gpt-4o)', 'gpt-4o')
      : modelProvider === 'anthropic'
      ? await input('5. Model name (Enter = claude-3-5-sonnet-20241022)', 'claude-3-5-sonnet-20241022')
      : await input('5. Model name (Enter = llama3.1)', 'llama3.1');

  const apiKey =
    modelProvider !== 'ollama'
      ? await input(
          `API Key for ${modelProvider} (Enter = from OPENAI_API_KEY env var)`,
          ''
        )
      : '';

  // 6. OWASP categories
  const owaspIds = await selectOwasp();

  // 7. Iterations
  const maxIterations = parseInt(
    await input('6. Max attack iterations (Enter = 3)', '3'),
    10
  );

  // 8. Auto-apply patches
  const apply = await confirm('7. Auto-apply defender patches?', false);

  // Summary
  console.log(chalk.bold.white('\n\n  ════════════════════════════════════════════════════'));
  console.log(chalk.bold.white('  Configuration Summary'));
  console.log(chalk.bold.white('  ════════════════════════════════════════════════════'));
  console.log(`  Goal:          ${chalk.white(goal)}`);
  console.log(
    `  Target:        ${chalk.cyan(targetType)} — ${chalk.white(targetUrl || pythonFn)}`
  );
  console.log(`  Model:         ${chalk.cyan(modelProvider)}/${chalk.white(modelName)}`);
  console.log(`  OWASP:         ${owaspIds.map((id) => (OWASP_COLOR[id] ?? chalk.white)(id)).join(', ')}`);
  console.log(`  Iterations:    ${chalk.white(maxIterations)}`);
  console.log(`  Auto-patch:    ${apply ? chalk.green('YES') : chalk.gray('NO (propose only)')}`);
  console.log(chalk.bold.white('  ════════════════════════════════════════════════════\n'));

  const launch = await confirm('Launch audit now?', true);
  if (!launch) {
    console.log(chalk.dim('\n  Aborted. Run `cyberpulse audit --help` for CLI flags.\n'));
    return;
  }

  // Run the audit
  const opts: AuditOptions = {
    target: {
      type: targetType as AuditOptions['target']['type'],
      url: targetUrl || undefined,
      pythonFn: pythonFn || undefined,
      headers: {},
    },
    model: {
      provider: modelProvider as AuditOptions['model']['provider'],
      model: modelName,
      apiKey: apiKey || undefined,
      baseUrl: undefined,
    },
    goal,
    maxIterations,
    apply,
    allowOpenCritical: false,
    output: 'text',
    outputFile: undefined,
    dbPath: process.env.CYBERPULSE_DB_PATH ?? 'data/cyberpulse.db',
  };

  // Build target config — avoid undefined fields (exactOptionalPropertyTypes)
  const target =
    targetType === 'python-fn'
      ? ({ type: 'python-fn', pythonFn } as const)
      : ({ type: targetType as 'http' | 'openai-compatible', url: targetUrl } as const);

  await runAudit(
    {
      goal,
      target: target as AuditConfig['target'],
      owaspIds: owaspIds as OwaspId[],
      maxIterations,
      applyPatches: apply,
      allowOpenCritical: false,
    },
    {
      provider: modelProvider as 'openai' | 'anthropic' | 'ollama',
      model: modelName,
      ...(apiKey ? { apiKey } : {}),
    },
    'text',
    process.env.CYBERPULSE_DB_PATH ?? 'data/cyberpulse.db'
  );
}
