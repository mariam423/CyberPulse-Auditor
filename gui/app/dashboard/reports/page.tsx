'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Copy, CheckCircle, AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface RunSummary {
  runId: string;
  status: string;
  goal: string;
  target: string;
  startedAt: string;
  finishedAt: string | null;
  findingsCount: number;
  openCount: number;
  closedCount: number;
}

interface Finding {
  id: string;
  owaspId: string;
  severity: string;
  title: string;
  closed: boolean;
}

const FORMAT_OPTIONS = ['markdown', 'sarif', 'json', 'html', 'text'] as const;
type Format = (typeof FORMAT_OPTIONS)[number];

export default function ReportsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<Format>('markdown');
  const [reportContent, setReportContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Retest state
  const [findings, setFindings] = useState<Finding[]>([]);
  const [retestFinding, setRetestFinding] = useState<string | null>(null);
  const [retesting, setRetesting] = useState(false);
  const [retestResult, setRetestResult] = useState<{
    verdict: string;
    closed: boolean;
    attemptsCount: number;
    evidence: string;
    retestedWith: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((data) => {
        setRuns(data.runs ?? []);
        if (data.runs?.length > 0) setSelectedRun(data.runs[0].runId);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load findings for the selected run (for the retest panel)
  useEffect(() => {
    if (!selectedRun) {
      setFindings([]);
      return;
    }
    fetch(`/api/runs/${selectedRun}`)
      .then((r) => r.json())
      .then((run) => setFindings(run.findings ?? []))
      .catch(() => setFindings([]));
    setRetestResult(null);
  }, [selectedRun]);

  const generateReport = async () => {
    if (!selectedRun) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/report/${selectedRun}?format=${selectedFormat}`);
      if (!res.ok) {
        const err = await res.json();
        setReportContent(`Error generating report: ${err.error ?? res.statusText}`);
        return;
      }
      setReportContent(await res.text());
    } catch (e) {
      setReportContent(`Error generating report: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const runRetest = async () => {
    if (!selectedRun || !retestFinding) return;
    setRetesting(true);
    setRetestResult(null);
    try {
      const res = await fetch('/api/retest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: selectedRun, findingId: retestFinding }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRetestResult({
          verdict: 'error',
          closed: false,
          attemptsCount: 0,
          evidence: data.error ?? 'Retest failed',
          retestedWith: '-',
        });
        return;
      }
      setRetestResult(data);
    } catch (e) {
      setRetestResult({
        verdict: 'error',
        closed: false,
        attemptsCount: 0,
        evidence: e instanceof Error ? e.message : 'Unknown error',
        retestedWith: '-',
      });
    } finally {
      setRetesting(false);
    }
  };

  const copyReport = () => {
    navigator.clipboard.writeText(reportContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-slate-400 text-sm mt-1">
          Unified reports — identical to the CLI (HTML, Markdown, JSON, SARIF 2.1.0)
        </p>
      </div>

      {/* Report config */}
      <div className="card-glass rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4" /> Configure Report
        </h2>

        {/* Run selector */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">Select Run</label>
          <select
            value={selectedRun ?? ''}
            onChange={(e) => setSelectedRun(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-midnight-700 border border-midnight-600 text-white focus:border-emerald-500/50 focus:outline-none font-mono text-sm"
          >
            <option value="">— Choose a run —</option>
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {r.runId.slice(0, 16)}… — {r.goal.slice(0, 50)}…
              </option>
            ))}
          </select>
        </div>

        {/* Format selector */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">Output Format</label>
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                  selectedFormat === fmt
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-midnight-700 border-midnight-600 text-slate-400 hover:border-midnight-500'
                )}
              >
                {fmt === 'sarif' ? 'SARIF 2.1.0' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generateReport}
            disabled={!selectedRun || generating}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all',
              !selectedRun || generating
                ? 'bg-midnight-700 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            )}
          >
            <Download className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Report'}
          </button>

          <a
            href={selectedRun ? `/api/report/${selectedRun}?format=${selectedFormat}&download=1` : undefined}
            aria-disabled={!selectedRun}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border transition-all',
              !selectedRun
                ? 'bg-midnight-700 text-slate-500 border-midnight-600 cursor-not-allowed pointer-events-none'
                : 'bg-midnight-700 text-cyan-300 border-cyan-500/40 hover:border-cyan-400 hover:text-cyan-200'
            )}
          >
            <Shield className="w-4 h-4" />
            Download {selectedFormat === 'sarif' ? 'SARIF' : selectedFormat.toUpperCase()}
          </a>
        </div>
      </div>

      {/* Report output */}
      {reportContent && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-midnight-700">
            <span className="text-sm text-slate-400 font-mono">
              {selectedFormat.toUpperCase()} Report
            </span>
            <button
              onClick={copyReport}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="p-5 text-sm text-slate-300 font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words">
            {reportContent}
          </pre>
        </div>
      )}

      {/* Retest panel — mirrors `cyberpulse retest` */}
      <div className="card-glass rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retest Finding
        </h2>
        <p className="text-xs text-slate-500 -mt-3">
          Re-runs validation against a finding to verify its patch — same engine as{' '}
          <code className="text-slate-400">cyberpulse retest --run &lt;id&gt; --finding &lt;id&gt;</code>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_auto] gap-3 items-end">
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Finding</label>
            <select
              value={retestFinding ?? ''}
              onChange={(e) => { setRetestFinding(e.target.value); setRetestResult(null); }}
              disabled={!selectedRun || findings.length === 0}
              className="w-full px-4 py-2.5 rounded-lg bg-midnight-700 border border-midnight-600 text-white focus:border-emerald-500/50 focus:outline-none font-mono text-sm disabled:opacity-50"
            >
              <option value="">— Choose a finding —</option>
              {findings.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.owaspId}] {f.severity.toUpperCase()} — {f.title.slice(0, 48)} {f.closed ? '(closed)' : '(open)'}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={runRetest}
            disabled={!retestFinding || retesting}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all',
              !retestFinding || retesting
                ? 'bg-midnight-700 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            )}
          >
            <RefreshCw className={clsx('w-4 h-4', retesting && 'animate-spin')} />
            {retesting ? 'Retesting...' : 'Run Retest'}
          </button>
        </div>

        {retestResult && (
          <div className={clsx(
            'rounded-lg border p-4 space-y-2',
            retestResult.verdict === 'closed'
              ? 'bg-green-500/10 border-green-500/30'
              : retestResult.verdict === 'open'
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
          )}>
            <div className="flex items-center gap-3">
              {retestResult.verdict === 'closed' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              )}
              <span className="font-bold text-white">
                Verdict: {retestResult.verdict.toUpperCase()}
              </span>
              <span className="text-slate-400 text-sm">
                {retestResult.attemptsCount} attempt(s) · retested with {retestResult.retestedWith}
              </span>
            </div>
            {retestResult.evidence && (
              <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {retestResult.evidence}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Quick stats */}
      {runs.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Runs', value: runs.length, icon: FileText, color: 'text-emerald-400' },
            { label: 'Total Open Findings', value: runs.reduce((s, r) => s + r.openCount, 0), icon: AlertTriangle, color: 'text-orange-400' },
            { label: 'Total Closed', value: runs.reduce((s, r) => s + r.closedCount, 0), icon: CheckCircle, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card-glass rounded-xl p-5">
              <div className={`flex items-center gap-2 mb-3 ${color}`}>
                <Icon className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-3xl font-bold text-white font-mono">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
}
