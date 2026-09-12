'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Radar, RefreshCw, CircleDot, CheckCircle, XCircle, Clock } from 'lucide-react';
import clsx from 'clsx';

interface AgentState {
  name: string;
  role: string;
  state: 'idle' | 'active' | 'complete' | 'error';
  activityCount: number;
  lastActiveAt: string | null;
}

interface Telemetry {
  timestamp: string;
  runCount: number;
  agents: AgentState[];
  remediation: {
    findings: number;
    patched: number;
    retested: number;
    closed: number;
    closureRate: number;
    open?: number;
  };
  severity: Record<string, number>;
  owasp: Record<string, number>;
  activeRun: {
    runId: string;
    status: string;
    startedAt: string;
    findings: number;
    openFindings: number;
    closedFindings: number;
    iterations: number;
  } | null;
}

/** Scalability vitals from /api/queue (async job pipeline). */
interface QueueStats {
  queue: { queued: number; running: number; terminal: number; workers: number; busy: number };
  storage: { driver: string; healthy: boolean };
  limiter: { backend: string };
  saturation: { utilizationPct: number };
}

const POLL_INTERVAL_MS = 3000;

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

const SEVERITY_BARS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-yellow-500',
  low: 'bg-emerald-500',
  info: 'bg-sky-500',
};

const OWASP_LABELS: Record<string, string> = {
  LLM01: 'Prompt Injection', LLM02: 'Insecure Output', LLM03: 'Training Data',
  LLM04: 'Model DoS', LLM05: 'Supply Chain', LLM06: 'Excessive Agency',
  LLM07: 'System Prompt Leak', LLM08: 'Embeddings', LLM09: 'Misinformation',
  LLM10: 'Model Theft',
};

function StateIcon({ state }: { state: AgentState['state'] }) {
  switch (state) {
    case 'active':
      return <CircleDot className="w-4 h-4 text-amber-400 animate-pulse" />;
    case 'complete':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-slate-500" />;
  }
}

export default function LivePage() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Telemetry = await res.json();
      setTelemetry(data);
      setConnected(true);
      setLastError(null);
      // Fire-and-forget queue vitals alongside telemetry.
      fetch('/api/queue', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((q: QueueStats | null) => q && setQueueStats(q))
        .catch(() => {});
    } catch (err) {
      setConnected(false);
      setLastError(err instanceof Error ? err.message : 'connection lost');
    }
  }, []);

  useEffect(() => {
    if (!live) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    fetchTelemetry();
    timerRef.current = setInterval(fetchTelemetry, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [live, fetchTelemetry]);

  const sev = telemetry?.severity ?? {};
  const owasp = telemetry?.owasp ?? {};
  const maxSev = Math.max(1, ...Object.values(sev));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Live Telemetry</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Real-time agent states, closed-loop remediation, and vulnerability stats
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <span className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap',
            connected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          )}>
            <span className={clsx('w-2 h-2 rounded-full', connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
          <button
            onClick={() => setLive((v) => !v)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap',
              live
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20'
            )}
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', live && 'animate-spin')} />
            {live ? `Polling · ${POLL_INTERVAL_MS / 1000}s` : 'Paused'}
          </button>
        </div>
      </div>

      {/* Agents row — 2 cols mobile, 5 desktop */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 flex flex-wrap items-center gap-2">
          <Radar className="w-5 h-5 text-amber-400 flex-shrink-0" />
          Agent States
          {telemetry && (
            <span className="text-[10px] sm:text-xs text-slate-500 font-normal">
              updated {new Date(telemetry.timestamp).toLocaleTimeString()}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {(telemetry?.agents ?? []).map((agent) => (
            <div key={agent.name} className="card-glass rounded-lg p-3 sm:p-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white font-mono truncate">{agent.name}</p>
                <StateIcon state={agent.state} />
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1 truncate">{agent.role}</p>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
                  agent.state === 'active' ? 'bg-amber-500/15 text-amber-400' :
                  agent.state === 'complete' ? 'bg-emerald-500/15 text-emerald-400' :
                  agent.state === 'error' ? 'bg-red-500/15 text-red-400' :
                  'bg-slate-500/15 text-slate-400'
                )}>
                  {agent.state}
                </span>
                {agent.activityCount > 0 && (
                  <span className="text-[10px] text-slate-500">{agent.activityCount} ops</span>
                )}
              </div>
            </div>
          ))}
          {!telemetry && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-5 card-glass rounded-lg p-6 sm:p-8 text-center text-slate-500 text-sm">
              Connecting to telemetry stream…
            </div>
          )}
        </div>
      </section>

      {/* Scalability vitals — async job queue + storage driver */}
      {queueStats && (
        <section>
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3">
            Job Queue &amp; Storage
            <span className="text-[10px] sm:text-xs text-slate-500 font-normal ml-2">
              async pipeline — scales to fleet deployments
            </span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="card-glass rounded-lg p-3 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Queued</p>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono mt-0.5">{queueStats.queue.queued}</p>
            </div>
            <div className="card-glass rounded-lg p-3 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Running</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-400 font-mono mt-0.5">{queueStats.queue.running}</p>
            </div>
            <div className="card-glass rounded-lg p-3 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Workers</p>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono mt-0.5">
                {queueStats.queue.busy}<span className="text-slate-600 text-base">/{queueStats.queue.workers}</span>
              </p>
            </div>
            <div className="card-glass rounded-lg p-3 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Storage</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${queueStats.storage.healthy ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs sm:text-sm text-slate-300 font-mono truncate">
                  {queueStats.storage.driver}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Closed-loop progress — stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card-glass rounded-xl p-4 sm:p-5">
          <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Findings</p>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono mt-1">{telemetry?.remediation.findings ?? '—'}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1">discovered across {telemetry?.runCount ?? 0} runs</p>
        </div>
        <div className="card-glass rounded-xl p-4 sm:p-5">
          <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Patched</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono mt-1">{telemetry?.remediation.patched ?? '—'}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1">defender patches applied</p>
        </div>
        <div className="card-glass rounded-xl p-4 sm:p-5">
          <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Closure Rate</p>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono mt-1">{telemetry ? `${telemetry.remediation.closureRate}%` : '—'}</p>
          <div className="mt-2 h-1.5 bg-obsidian-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={telemetry?.remediation.closureRate ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${telemetry?.remediation.closureRate ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vulnerability telemetry — stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="card-glass rounded-xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-white mb-3">Severity Distribution</p>
          <div className="space-y-2">
            {SEVERITY_ORDER.map((sevKey) => {
              const count = sev[sevKey] ?? 0;
              return (
                <div key={sevKey} className="flex items-center gap-2 sm:gap-3">
                  <span className={clsx('px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold uppercase border w-16 sm:w-20 text-center flex-shrink-0', SEVERITY_COLORS[sevKey])}>
                    {sevKey}
                  </span>
                  <div className="flex-1 h-2 bg-obsidian-700 rounded-full overflow-hidden min-w-0">
                    <div
                      className={clsx('h-full rounded-full transition-all duration-500', SEVERITY_BARS[sevKey])}
                      style={{ width: `${(count / maxSev) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-300 font-mono w-6 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
            {Object.keys(sev).length === 0 && telemetry && (
              <p className="text-xs text-slate-500">No findings in the latest run.</p>
            )}
          </div>
        </div>

        <div className="card-glass rounded-xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-white mb-3">OWASP Coverage</p>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {Object.entries(OWASP_LABELS).map(([id, label]) => {
              const count = owasp[id] ?? 0;
              return (
                <div key={id} className={clsx(
                  'flex items-center justify-between px-2.5 sm:px-3 py-2 rounded-lg border min-w-0',
                  count > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-obsidian-800/50 border-obsidian-700'
                )}>
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-bold text-white">{id}</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">{label}</p>
                  </div>
                  <span className={clsx('text-sm font-mono font-bold flex-shrink-0 ml-2', count > 0 ? 'text-red-400' : 'text-slate-600')}>
                    {telemetry ? count : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {lastError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-300" role="alert">
          Telemetry error: {lastError}
        </div>
      )}
    </div>
  );
}
