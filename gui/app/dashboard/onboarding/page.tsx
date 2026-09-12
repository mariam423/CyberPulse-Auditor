'use client';

import { useState } from 'react';
import {
  Terminal, Download, Apple, Monitor, Shield, BookOpen,
  Zap, Database, ChevronDown, ChevronUp, CheckCheck, Copy, Check,
} from 'lucide-react';
import clsx from 'clsx';

type Platform = 'linux' | 'macos' | 'windows';

const PLATFORM_META: Record<Platform, { label: string; icon: typeof Apple; shell: string }> = {
  linux: { label: 'Linux', icon: Terminal, shell: 'bash' },
  macos: { label: 'macOS', icon: Apple, shell: 'zsh' },
  windows: { label: 'Windows', icon: Monitor, shell: 'PowerShell' },
};

const INSTALL_STEPS: Record<Platform, Array<{ title: string; commands: string[]; note?: string }>> = {
  linux: [
    {
      title: '1 · Install prerequisites',
      commands: [
        '# Node.js 20+ (Ubuntu / Debian)',
        'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -',
        'sudo apt-get install -y nodejs',
        '',
        '# Verify',
        'node --version   # v20.x or newer',
      ],
    },
    {
      title: '2 · Clone & build the core',
      commands: [
        'git clone https://github.com/example/cyberpulse-auditor.git',
        'cd cyberpulse-auditor',
        'npm install',
        'npm run build',
      ],
    },
    {
      title: '3 · Install the GUI dashboard',
      commands: [
        'cd gui',
        'npm install',
        'cd ..',
      ],
      note: 'The GUI shares the same SQLite database as the CLI — no extra configuration.',
    },
    {
      title: '4 · Launch',
      commands: [
        '# Terminal UX (block-art banner + silent spinners)',
        'npm run cyberpulse audit --goal "probe" --target-url http://localhost:8080 --target-type http',
        '',
        '# Web dashboard',
        'npm run cyberpulse gui',
      ],
    },
  ],
  macos: [
    {
      title: '1 · Install prerequisites',
      commands: [
        '# Node.js 20+ via Homebrew',
        'brew install node@20',
        '',
        '# Verify',
        'node --version   # v20.x or newer',
      ],
    },
    {
      title: '2 · Clone & build the core',
      commands: [
        'git clone https://github.com/example/cyberpulse-auditor.git',
        'cd cyberpulse-auditor',
        'npm install',
        'npm run build',
      ],
    },
    {
      title: '3 · Install the GUI dashboard',
      commands: [
        'cd gui',
        'npm install',
        'cd ..',
      ],
      note: 'The GUI shares the same SQLite database as the CLI — no extra configuration.',
    },
    {
      title: '4 · Launch',
      commands: [
        '# Terminal UX (block-art banner + silent spinners)',
        'npm run cyberpulse audit --goal "probe" --target-url http://localhost:8080 --target-type http',
        '',
        '# Web dashboard',
        'npm run cyberpulse gui',
      ],
    },
  ],
  windows: [
    {
      title: '1 · Install prerequisites',
      commands: [
        '# Node.js 20+ LTS — download the MSI:',
        '# https://nodejs.org/en/download',
        '',
        '# Verify in PowerShell',
        'node --version   # v20.x or newer',
      ],
    },
    {
      title: '2 · Clone & build the core',
      commands: [
        'git clone https://github.com/example/cyberpulse-auditor.git',
        'cd cyberpulse-auditor',
        'npm install',
        'npm run build',
      ],
    },
    {
      title: '3 · Install the GUI dashboard',
      commands: [
        'cd gui',
        'npm install',
        'cd ..',
      ],
      note: 'The GUI shares the same SQLite database as the CLI — no extra configuration.',
    },
    {
      title: '4 · Launch',
      commands: [
        '# Terminal UX (block-art banner + silent spinners)',
        'npm run cyberpulse audit --goal "probe" --target-url http://localhost:8080 --target-type http',
        '',
        '# Web dashboard',
        'npm run cyberpulse gui',
      ],
    },
  ],
};

const CLI_REFERENCE: Array<{ cmd: string; desc: string }> = [
  { cmd: 'cyberpulse', desc: 'Interactive launcher menu (wizard / GUI / direct audit)' },
  { cmd: 'cyberpulse gui', desc: 'Launch the Next.js dashboard at localhost:3000' },
  { cmd: 'cyberpulse audit --goal <text> --target-url <url> --target-type <type>', desc: 'Full closed-loop audit (attack → classify → patch → retest)' },
  { cmd: 'cyberpulse audit ... --apply --patch-root <dir>', desc: 'Auto-apply generated code patches to the target codebase' },
  { cmd: 'cyberpulse audit ... --dry-run-patches', desc: 'Review + harden patches without writing to disk' },
  { cmd: 'cyberpulse retest --run <id> --finding <id>', desc: 'Re-run validation on a finding to verify its patch' },
  { cmd: 'cyberpulse report --run <id> --format sarif', desc: 'Generate a report (json | markdown | sarif | html | text)' },
  { cmd: 'cyberpulse audit ... --verbose', desc: 'Stream internal logs to stderr (default run is silent)' },
  { cmd: 'cyberpulse audit ... --debug', desc: 'Full debug telemetry to stderr — stdout stays pipe-clean' },
];

const FEATURES: Array<{ icon: typeof Shield; title: string; desc: string }> = [
  { icon: Shield, title: 'OWASP LLM Top 10', desc: '10 vulnerability categories incl. SSRF & insecure deserialization vectors' },
  { icon: Zap, title: 'Closed-Loop Engine', desc: 'Attacker → Evaluator → Defender → Validator, mirrored to SQLite' },
  { icon: Terminal, title: 'Silent CLI UX', desc: 'Block-art banner, braille spinners, verbose only on --verbose/--debug' },
  { icon: Database, title: 'Shared SQLite Core', desc: 'CLI and GUI read/write the same audit trail — zero drift' },
];

function CodeBlock({ commands, shell }: { commands: string[]; shell: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(commands.filter((c) => !c.startsWith('#') || c.includes('://')).join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-lg bg-midnight-950 border border-midnight-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-midnight-700 bg-midnight-800/50">
        <span className="text-xs text-slate-500 font-mono">{shell}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors">
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm text-emerald-300/90 font-mono overflow-x-auto leading-relaxed">
        {commands.join('\n')}
      </pre>
    </div>
  );
}

export default function OnboardingPage() {
  const [platform, setPlatform] = useState<Platform>('linux');
  const [cliOpen, setCliOpen] = useState(true);
  const meta = PLATFORM_META[platform];
  const steps = INSTALL_STEPS[platform];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Getting Started</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Set up CyberPulse Auditor on your platform — CLI and GUI share one core.
            </p>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card-glass rounded-xl p-5">
            <Icon className="w-5 h-5 text-emerald-400 mb-3" />
            <p className="text-sm font-semibold text-white mb-1">{title}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Platform selector */}
      <section className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-400" />
            Installation
          </h2>
          <div className="flex gap-2">
            {(Object.keys(PLATFORM_META) as Platform[]).map((p) => {
              const PIcon = PLATFORM_META[p].icon;
              return (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                    platform === p
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-midnight-700 border-midnight-600 text-slate-400 hover:border-midnight-500'
                  )}
                >
                  <PIcon className="w-4 h-4" />
                  {PLATFORM_META[p].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {steps.map((step) => (
            <div key={step.title} className="card-glass rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-emerald-400">{step.title}</h3>
              <CodeBlock commands={step.commands} shell={meta.shell} />
              {step.note && (
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <CheckCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {step.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CLI reference */}
      <section className="card-glass rounded-xl overflow-hidden">
        <button
          onClick={() => setCliOpen(!cliOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-midnight-700/30 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Terminal className="w-4 h-4 text-emerald-400" />
            CLI Command Reference
          </span>
          {cliOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {cliOpen && (
          <div className="px-6 pb-6 space-y-3">
            {CLI_REFERENCE.map(({ cmd, desc }) => (
              <div key={cmd} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-1 md:gap-4 items-baseline">
                <code className="text-xs text-emerald-300/90 font-mono break-all">{cmd}</code>
                <span className="text-xs text-slate-500">{desc}</span>
              </div>
            ))}
            <p className="text-xs text-slate-500 pt-2 border-t border-midnight-700 mt-4">
              All commands support <code className="text-slate-400">--verbose</code> / <code className="text-slate-400">--debug</code> — internal logs stream to stderr while stdout stays pipe-clean.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
