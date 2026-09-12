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

const POLL_INTERVAL_MS = 3000;

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/15 text-green-400 border-green-500/30',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
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
      return <CircleDot className="w-4 h-4 text-emerald-400 animate-pulse" />;
    case 'complete':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-slate-500" />;
  }
}

export default function LivePage() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
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
  const maxOwasp = Math.max(1, ...Object.values(owasp));

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Telemetry</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time agent states, closed-loop remediation, and vulnerability stats
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border',
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
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              live
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20'
            )}
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', live && 'animate-spin')} />
            {live ? `Polling · ${POLL_INTERVAL_MS / 1000}s` : 'Paused'}
          </button>
        </div>
      </div>

      {/* Agents row */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Radar className="w-5 h-5 text-emerald-400" />
          Agent States
          {telemetry && (
            <span className="text-xs text-slate-500 font-normal ml-2">
              updated {new Date(telemetry.timestamp).toLocaleTimeString()}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {(telemetry?.agents ?? []).map((agent) => (
            <div key={agent.name} className="card-glass rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white font-mono">{agent.name}</p>
                <StateIcon state={agent.state} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{agent.role}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
                  agent.state === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                  agent.state === 'complete' ? 'bg-green-500/15 text-green-400' :
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
            <div className="col-span-5 card-glass rounded-lg p-8 text-center text-slate-500">
              Connecting to telemetry stream…
            </div>
          )}
        </div>
      </div>

      {/* Closed-loop progress */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-glass rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Findings</p>
          <p className="text-3xl font-bold text-white font-mono mt-1">{telemetry?.remediation.findings ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-1">discovered across {telemetry?.runCount ?? 0} runs</p>
        </div>
        <div className="card-glass rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Patched</p>
          <p className="text-3xl font-bold text-emerald-400 font-mono mt-1">{telemetry?.remediation.patched ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-1">defender patches applied</p>
        </div>
        <div className="card-glass rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Closure Rate</p>
          <p className="text-3xl font-bold text-white font-mono mt-1">{telemetry ? `${telemetry.remediation.closureRate}%` : '—'}</p>
          <div className="mt-2 h-1.5 bg-midnight-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${telemetry?.remediation.closureRate ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vulnerability telemetry */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-glass rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-3">Severity Distribution</p>
          <div className="space-y-2">
            {SEVERITY_ORDER.map((sevKey) => {
              const count = sev[sevKey] ?? 0;
              return (
                <div key={sevKey} className="flex items-center gap-3">
                  <span className={clsx('px-2 py-0.5 rounded text-xs font-bold uppercase border w-20 text-center', SEVERITY_COLORS[sevKey])}>
                    {sevKey}
                  </span>
                  <div className="flex-1 h-2 bg-midnight-700 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full transition-all duration-500', 
                        sevKey === 'critical' ? 'bg-red-500' : 
                        sevKey === 'high' ? 'bg-orange-500' :
                        sevKey === 'medium' ? 'bg-yellow-500' :
                        sevKey === 'low' ? 'bg-green-500' : 'bg-blue-500')}
                      style={{ width: `${(count / maxSev) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-300 font-mono w-6 text-right">{count}</span>
                </div>
              );
            })}
            {Object.keys(sev).length === 0 && telemetry && (
              <p className="text-xs text-slate-500">No findings in the latest run.</p>
            )}
          </div>
        </div>

        <div className="card-glass rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-3">OWASP Coverage</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(OWASP_LABELS).map(([id, label]) => {
              const count = owasp[id] ?? 0;
              return (
                <div key={id} className={clsx(
                  'flex items-center justify-between px-3 py-2 rounded-lg border',
                  count > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-midnight-800/50 border-midnight-700'
                )}>
                  <div>
                    <p className="text-xs font-mono font-bold text-white">{id}</p>
                    <p className="text-[10px] text-slate-500">{label}</p>
                  </div>
                  <span className={clsx('text-sm font-mono font-bold', count > 0 ? 'text-red-400' : 'text-slate-600')}>
                    {telemetry ? count : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {lastError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-300">
          Telemetry error: {lastError}
        </div>
      )}
    </div>
  );
}
