'use client';

/**
 * /download — Landing + installer page
 * ──────────────────────────────────
 * Public-facing download surface with:
 *   - Hero: CyberPulse value proposition (obsidian/amber identity)
 *   - InstallSnippet: interactive OS-tabbed CLI installer widget
 *   - Docker quick-start card (universal deployment path)
 *   - Feature grid + security posture strip
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield, Activity, Terminal, Container, Copy, Check,
  Radar, Lock, Database, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import InstallSnippet from '@/components/InstallSnippet';

const FEATURES = [
  {
    icon: Radar,
    title: 'OWASP LLM Top 10',
    desc: 'Closed-loop audits across prompt injection, SSRF, deserialization and 7 more categories.',
  },
  {
    icon: Activity,
    title: 'Multi-Agent Engine',
    desc: 'Attacker → Evaluator → Defender → Validator, with Copaw/OpenClaude/Hermes/Pi delegation.',
  },
  {
    icon: Database,
    title: 'Shared SQLite Core',
    desc: 'CLI and GUI read/write the same audit trail — zero drift, full history.',
  },
  {
    icon: Lock,
    title: 'Hardened by Default',
    desc: 'Zod-validated inputs, rate-limited APIs, CSP + HSTS headers, env-only credentials.',
  },
];

const DOCKER_COMMAND = 'docker compose up --build';

export default function DownloadPage() {
  const [dockerCopied, setDockerCopied] = useState(false);

  const copyDocker = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DOCKER_COMMAND);
      setDockerCopied(true);
      setTimeout(() => setDockerCopied(false), 1600);
    } catch {
      // clipboard unavailable — text stays selectable
    }
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-900 text-slate-100">
      {/* Amber top accent */}
      <div
        className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent pointer-events-none z-50"
        aria-hidden="true"
      />

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-white leading-tight truncate">CyberPulse</p>
            <p className="text-[11px] text-amber-400/80 leading-tight">Auditor</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-obsidian-700 border border-obsidian-600 text-slate-200 text-xs sm:text-sm font-semibold hover:border-amber-500/40 hover:text-amber-400 transition-all flex-shrink-0"
        >
          Open Dashboard
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-12 sm:space-y-16">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="pt-6 sm:pt-10 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-5 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
              v0.1.0 — Multi-Agent LLM Security Copilot
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Audit LLM apps against the{' '}
              <span className="text-amber-400 text-glow-amber">OWASP Top 10</span> — autonomously.
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl">
              CyberPulse runs closed-loop red-team audits: attacks your target, classifies findings,
              generates and verifies patches — from a silent CLI or this live dashboard. Runs
              anywhere via Docker.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="#install"
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-obsidian-900 text-sm font-bold transition-all shadow-lg shadow-amber-500/25"
              >
                <Terminal className="w-4 h-4" />
                Install the CLI
              </a>
              <a
                href="#docker"
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-obsidian-700 border border-obsidian-600 text-slate-200 text-sm font-semibold hover:border-amber-500/40 transition-all"
              >
                <Container className="w-4 h-4 text-amber-400" />
                Docker quick-start
              </a>
            </div>
          </div>

          {/* Installer widget — the centerpiece */}
          <div id="install" className="scroll-mt-24 min-w-0">
            <InstallSnippet />
          </div>
        </section>

        {/* ── Docker card ─────────────────────────────────────────────── */}
        <section id="docker" className="scroll-mt-24">
          <div className="card-glass rounded-xl p-5 sm:p-8 grid lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-2.5">
                <Container className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <h2 className="text-lg sm:text-xl font-bold text-white">Run it anywhere with Docker</h2>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                One command builds the multi-stage image (Next.js GUI + Node audit engine + SQLite
                volume) and starts the whole platform — laptop, server, or cloud.
              </p>
              <div className="rounded-lg bg-obsidian-950 border border-obsidian-700 overflow-hidden inline-block w-full max-w-xl">
                <div className="flex items-center justify-between px-4 py-2 border-b border-obsidian-700 bg-obsidian-800/50">
                  <span className="text-[11px] text-slate-500 font-mono">any OS with Docker</span>
                  <button
                    onClick={copyDocker}
                    aria-label={dockerCopied ? 'Docker command copied' : 'Copy Docker command'}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all',
                      dockerCopied
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : 'bg-obsidian-700 text-slate-400 border-obsidian-600 hover:text-amber-400 hover:border-amber-500/40'
                    )}
                  >
                    {dockerCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {dockerCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 text-xs sm:text-sm text-amber-300/90 font-mono overflow-x-auto whitespace-pre" tabIndex={0}>
                  {DOCKER_COMMAND}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-5">Why CyberPulse</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card-glass rounded-xl p-4 sm:p-5 flex items-start gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white mb-1">{title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security posture strip ──────────────────────────────────── */}
        <section className="card-glass rounded-xl px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 justify-center sm:justify-between">
          {['Zod input validation', 'Rate-limited APIs', 'CSP + HSTS headers', 'Env-only credentials', 'OWASP-aligned rule engine'].map((item) => (
            <span key={item} className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
              {item}
            </span>
          ))}
        </section>
      </main>

      <footer className="border-t border-obsidian-700 py-6 text-center">
        <p className="text-xs text-slate-500">
          CyberPulse Auditor — Multi-Agent LLM Security Copilot ·{' '}
          <Link href="/dashboard/onboarding" className="text-amber-400/80 hover:text-amber-400">
            Full setup guide
          </Link>
        </p>
      </footer>
    </div>
  );
}
