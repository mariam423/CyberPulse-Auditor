'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
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

const FORMAT_OPTIONS = ['markdown', 'sarif', 'json', 'html', 'text'] as const;

export default function ReportsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<typeof FORMAT_OPTIONS[number]>('markdown');
  const [reportContent, setReportContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const generateReport = async () => {
    if (!selectedRun) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/runs/${selectedRun}`);
      const run = await res.json();
      // Format as the selected format (basic JSON dump for now)
      if (selectedFormat === 'json') {
        setReportContent(JSON.stringify(run, null, 2));
      } else if (selectedFormat === 'markdown') {
        const findingsMd = run.findings?.map((f: { owaspId: string; severity: string; title: string; evidence: string; closed: boolean }) =>
          `### ${f.owaspId} — ${f.title} [${f.closed ? 'CLOSED' : 'OPEN'}]\n**Severity:** ${f.severity}\n\n${f.evidence}\n`
        ).join('\n---\n\n') ?? 'No findings.';
        setReportContent(`# Security Audit Report\n\n**Run ID:** ${run.runId}\n**Goal:** ${run.goal}\n**Target:** ${run.target}\n**Status:** ${run.status}\n\n## Findings\n\n${findingsMd}`);
      } else {
        setReportContent(JSON.stringify(run, null, 2));
      }
    } catch (e) {
      setReportContent(`Error generating report: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
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
        <p className="text-slate-400 text-sm mt-1">Generate formatted security audit reports</p>
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
          <div className="flex gap-2">
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
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

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
          <pre className="p-5 text-sm text-slate-300 font-mono overflow-x-auto max-h-[500px] overflow-y-auto">
            {reportContent}
          </pre>
        </div>
      )}

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
    </div>
  );
}
