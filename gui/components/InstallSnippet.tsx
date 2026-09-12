'use client';

/**
 * InstallSnippet — interactive CLI installer widget
 * ──────────────────────────────────────────────────
 * OS selector tabs (Linux / macOS / Windows) with dynamically tailored
 * terminal commands, install-method toggle (quick script vs npm), and an
 * accessible copy-to-clipboard button.
 *
 * Commands resolve from NEXT_PUBLIC_* env vars so the deployment can point
 * the snippets at its own install-script host / npm registry.
 */

import { useState, useCallback } from 'react';
import { Terminal, Apple, Monitor, Copy, Check, Package, Zap } from 'lucide-react';
import clsx from 'clsx';

export type Platform = 'linux' | 'macos' | 'windows';

const PLATFORM_META: Record<
  Platform,
  { label: string; icon: typeof Terminal; shell: string }
> = {
  linux: { label: 'Linux', icon: Terminal, shell: 'bash' },
  macos: { label: 'macOS', icon: Apple, shell: 'zsh' },
  windows: { label: 'Windows', icon: Monitor, shell: 'PowerShell' },
};

// Install endpoints — configurable per deployment (see .env.example)
const INSTALL_SCRIPT_BASE =
  process.env.NEXT_PUBLIC_INSTALL_SCRIPT_URL ?? 'https://cyberpulse.dev/install';
const NPM_PACKAGE = process.env.NEXT_PUBLIC_NPM_PACKAGE ?? 'cyberpulse-auditor';

export type InstallMethod = 'script' | 'npm';

/** Primary one-liner for the selected OS + method. */
export function installCommand(platform: Platform, method: InstallMethod): string {
  if (method === 'npm') {
    // npm works identically on every OS once Node 20+ is present.
    return `npm install -g ${NPM_PACKAGE}`;
  }
  switch (platform) {
    case 'windows':
      // PowerShell: Invoke-WebRequest → Invoke-Expression
      return `iwr -useb ${INSTALL_SCRIPT_BASE}/windows.ps1 | iex`;
    case 'macos':
      return `curl -sSL ${INSTALL_SCRIPT_BASE}/macos.sh | bash`;
    case 'linux':
    default:
      return `curl -sSL ${INSTALL_SCRIPT_BASE}/linux.sh | bash`;
  }
}

/** Follow-up verification command (post-install sanity check). */
export function verifyCommand(_platform: Platform): string {
  return 'cyberpulse --version && cyberpulse --help';
}

interface InstallSnippetProps {
  /** Compact variant for embedding inside pages (default: standalone card). */
  compact?: boolean;
  /** Override the default visible platform. */
  initialPlatform?: Platform;
}

export default function InstallSnippet({ compact = false, initialPlatform = 'linux' }: InstallSnippetProps) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [method, setMethod] = useState<InstallMethod>('script');
  const [copied, setCopied] = useState(false);

  const command = installCommand(platform, method);
  const verify = verifyCommand(platform);
  const meta = PLATFORM_META[platform];

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — no-op; the
      // command remains selectable text for manual copy.
    }
  }, [command]);

  return (
    <div
      className={clsx(
        'card-glass rounded-xl overflow-hidden',
        compact ? '' : 'animate-slide-up'
      )}
      role="group"
      aria-label="CLI installer"
    >
      {/* ── OS selector tabs ─────────────────────────────────────────── */}
      <div
        className="flex border-b border-obsidian-700"
        role="tablist"
        aria-label="Choose your operating system"
      >
        {(Object.keys(PLATFORM_META) as Platform[]).map((key) => {
          const pm = PLATFORM_META[key];
          const Icon = pm.icon;
          const active = platform === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              aria-controls={`install-panel-${key}`}
              id={`install-tab-${key}`}
              onClick={() => setPlatform(key)}
              className={clsx(
                'flex-1 min-w-0 flex items-center justify-center gap-2 px-2 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2',
                active
                  ? 'text-amber-400 border-amber-500 bg-amber-500/5'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-obsidian-700/40'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{pm.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Method toggle: quick script vs npm ───────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-obsidian-700 bg-obsidian-850/60"
        role="tablist"
        aria-label="Choose install method"
      >
        <button
          role="tab"
          aria-selected={method === 'script'}
          onClick={() => setMethod('script')}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all',
            method === 'script'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
              : 'bg-obsidian-700 text-slate-400 border-obsidian-600 hover:text-white'
          )}
        >
          <Zap className="w-3 h-3" />
          Quick script
        </button>
        <button
          role="tab"
          aria-selected={method === 'npm'}
          onClick={() => setMethod('npm')}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all',
            method === 'npm'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
              : 'bg-obsidian-700 text-slate-400 border-obsidian-600 hover:text-white'
          )}
        >
          <Package className="w-3 h-3" />
          npm
        </button>
      </div>

      {/* ── Command panel ───────────────────────────────────────────── */}
      <div
        id={`install-panel-${platform}`}
        role="tabpanel"
        aria-labelledby={`install-tab-${platform}`}
        className="p-3 sm:p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] sm:text-xs text-slate-500 font-mono flex items-center gap-1.5 min-w-0">
            <span
              className={clsx(
                'w-2 h-2 rounded-full flex-shrink-0',
                platform === 'macos' ? 'bg-amber-400' : platform === 'windows' ? 'bg-sky-400' : 'bg-emerald-400'
              )}
              aria-hidden="true"
            />
            {meta.shell}
          </span>
          <button
            onClick={copy}
            aria-label={copied ? 'Command copied to clipboard' : `Copy ${meta.label} install command to clipboard`}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all flex-shrink-0',
              copied
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : 'bg-obsidian-700 text-slate-300 border-obsidian-600 hover:border-amber-500/40 hover:text-amber-400'
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="rounded-lg bg-obsidian-950 border border-obsidian-700 overflow-hidden">
          <pre
            className="p-3 sm:p-4 text-[11px] sm:text-sm text-amber-300/90 font-mono overflow-x-auto leading-relaxed whitespace-pre"
            tabIndex={0}
            aria-label={`Install command for ${meta.label}`}
          >
            {command}
          </pre>
        </div>

        <div className="rounded-lg bg-obsidian-950/60 border border-obsidian-700/60 overflow-hidden">
          <pre
            className="p-3 text-[10px] sm:text-xs text-slate-400 font-mono overflow-x-auto leading-relaxed whitespace-pre"
            tabIndex={0}
            aria-label="Verification command"
          >
            <span className="text-slate-600 select-none"># verify the install{'\n'}</span>
            {verify}
          </pre>
        </div>

        <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed">
          Requires Node.js 20+. The CLI and this dashboard share the same SQLite
          audit trail — run audits from either surface.
        </p>
      </div>
    </div>
  );
}
