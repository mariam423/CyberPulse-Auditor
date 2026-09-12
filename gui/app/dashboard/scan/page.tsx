'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ChevronDown, ChevronUp, AlertTriangle, Zap, Shield, X } from 'lucide-react';
import clsx from 'clsx';

const OWASP_CATEGORIES = [
  { id: 'LLM01', label: 'Prompt Injection', color: 'text-red-400' },
  { id: 'LLM02', label: 'Insecure Output', color: 'text-orange-400' },
  { id: 'LLM03', label: 'Training Data Poisoning', color: 'text-yellow-400' },
  { id: 'LLM04', label: 'Model DoS', color: 'text-green-400' },
  { id: 'LLM05', label: 'Supply Chain', color: 'text-blue-400' },
  { id: 'LLM06', label: 'Excessive Agency', color: 'text-violet-400' },
  { id: 'LLM07', label: 'System Prompt Leak', color: 'text-purple-400' },
  { id: 'LLM08', label: 'Embedding Weaknesses', color: 'text-pink-400' },
  { id: 'LLM09', label: 'Misinformation', color: 'text-slate-400' },
  { id: 'LLM10', label: 'Model Theft', color: 'text-white' },
];

const PHASES = ['Initializing', 'Recon', 'Attack', 'Classify', 'Remediate', 'Retest', 'Complete'];

export default function ScanPage() {
  const router = useRouter();

  const [goal, setGoal] = useState('Probe for prompt injection vulnerabilities');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetType, setTargetType] = useState<'http' | 'openai-compatible' | 'python-fn'>('http');
  const [selectedOwasp, setSelectedOwasp] = useState<string[]>(OWASP_CATEGORIES.map(c => c.id));
  const [maxIterations, setMaxIterations] = useState(3);
  const [applyPatches, setApplyPatches] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentOwasp, setCurrentOwasp] = useState('');
  const [error, setError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const toggleOwasp = (id: string) => {
    setSelectedOwasp(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleScan = useCallback(async () => {
    if (!targetUrl && targetType === 'http') {
      setError('Target URL is required for HTTP targets');
      return;
    }

    setScanning(true);
    setProgress(0);
    setError('');
    setJobId(null);

    try {
      // ── Async enqueue: returns a jobId in ~1ms (non-blocking) ──
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          target: { type: targetType, url: targetUrl },
          model: { provider: 'openai', model: 'gpt-4o' },
          owaspIds: selectedOwasp,
          maxIterations,
          applyPatches,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Scan failed to start');
        setScanning(false);
        return;
      }

      const data = await res.json();
      const id: string = data.jobId;
      setJobId(id);
      setCurrentPhase('Queued');

      // ── Poll job status until terminal ──────────────────────────
      await new Promise<void>((resolve) => {
        const poll = async () => {
          try {
            const r = await fetch(`/api/scan/${id}`, { cache: 'no-store' });
            if (!r.ok) {
              setError('Lost track of the scan job');
              setScanning(false);
              resolve();
              return;
            }
            const job = await r.json();
            setProgress(job.progress ?? 0);
            setCurrentPhase(job.phase ?? 'running');

            if (job.status === 'complete') {
              setProgress(100);
              setCurrentPhase('Complete');
              setScanning(false);
              resolve();
              // Brief pause so the user sees 100%, then navigate.
              setTimeout(() => router.push('/dashboard/runs'), 900);
            } else if (job.status === 'error') {
              setError(job.error ?? 'Audit worker failed');
              setScanning(false);
              resolve();
            } else if (job.status === 'cancelled') {
              setError('Scan was cancelled');
              setScanning(false);
              resolve();
            } else {
              setTimeout(poll, 1500); // queued/running → keep polling
            }
          } catch {
            setError('Connection lost while polling scan status');
            setScanning(false);
            resolve();
          }
        };
        setTimeout(poll, 600);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setScanning(false);
    }
  }, [goal, targetUrl, targetType, selectedOwasp, maxIterations, applyPatches, router]);

  const allSelected = selectedOwasp.length === OWASP_CATEGORIES.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
          <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
          New Security Scan
        </h1>
        <p className="text-slate-400 text-sm mt-1">Configure and launch a CyberPulse audit run</p>
      </div>

      {/* Target Config */}
      <section className="card-glass rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4" /> Target Configuration
        </h2>

        {/* Target type */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">Target Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['http', 'openai-compatible', 'python-fn'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTargetType(type)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                  targetType === type
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                    : 'bg-obsidian-700 border-obsidian-600 text-slate-400 hover:border-obsidian-500'
                )}
              >
                {type === 'http' ? '🌐 HTTP API' :
                 type === 'openai-compatible' ? '🔑 OpenAI Compatible' : '🐍 Python Function'}
              </button>
            ))}
          </div>
        </div>

        {/* Target URL */}
        {(targetType === 'http' || targetType === 'openai-compatible') && (
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Target URL</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://your-llm-endpoint.com/v1/chat"
              className="w-full px-4 py-2.5 rounded-lg bg-obsidian-700 border border-obsidian-600 text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 font-mono text-sm"
            />
          </div>
        )}
      </section>

      {/* Security Goal */}
      <section className="card-glass rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Security Goal</h2>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          placeholder="e.g. Probe for prompt injection and excessive agency vulnerabilities"
          className="w-full px-4 py-3 rounded-lg bg-obsidian-700 border border-obsidian-600 text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 text-sm resize-none"
        />
      </section>

      {/* OWASP Categories */}
      <section className="card-glass rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">OWASP Categories</h2>
          <button
            onClick={() => setSelectedOwasp(allSelected ? [] : OWASP_CATEGORIES.map(c => c.id))}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OWASP_CATEGORIES.map((cat) => {
            const selected = selectedOwasp.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleOwasp(cat.id)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium text-left transition-all',
                  selected
                    ? 'bg-amber-500/10 border-amber-500/30 text-white'
                    : 'bg-bg-obsidian-700/50 border-obsidian-600 text-slate-400 hover:border-obsidian-500'
                )}
              >
                <span className={clsx('w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all',
                  selected ? 'bg-amber-500 border-amber-500' : 'border-obsidian-500'
                )}>
                  {selected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: selected ? undefined : undefined }}>{cat.id}</span>
                <span className="text-slate-300 text-xs">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Advanced */}
      <section className="card-glass rounded-xl overflow-hidden">
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-obsidian-700/30 transition-colors"
        >
          <span className="text-sm font-semibold text-slate-300">Advanced Options</span>
          {advancedOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {advancedOpen && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Max Iterations: <span className="text-amber-400 font-mono">{maxIterations}</span></label>
              <input
                type="range" min={1} max={10} value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={applyPatches}
                onChange={(e) => setApplyPatches(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <span className="text-sm text-slate-300">Auto-apply patches (default: propose only)</span>
            </label>
          </div>
        )}
      </section>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Scan button / progress */}
      {scanning ? (
        <div className="card-glass rounded-xl p-6 space-y-4 animate-slide-up">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <span className="text-amber-400 font-semibold">Scan in progress...</span>
            <span className="text-slate-400 text-sm ml-auto">{currentPhase}</span>
          </div>
          <div
            className="w-full bg-obsidian-700 rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Scan progress"
          >
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {jobId && (
            <p className="text-xs text-slate-500 font-mono truncate">
              Job: <span className="text-slate-400">{jobId}</span>
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleScan}
          disabled={selectedOwasp.length === 0}
          className={clsx(
            'w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg',
            selectedOwasp.length > 0
              ? 'bg-amber-500 hover:bg-amber-600 text-obsidian-900 shadow-amber-500/30 cursor-pointer'
              : 'bg-obsidian-700 text-slate-500 cursor-not-allowed'
          )}
        >
          <Zap className="w-4 h-4" />
          Launch Scan ({selectedOwasp.length} categories)
        </button>
      )}
    </div>
  );
}
