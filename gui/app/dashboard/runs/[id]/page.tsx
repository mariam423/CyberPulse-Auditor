'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface Finding {
  id: string;
  owaspId: string;
  severity: string;
  title: string;
  evidence: string;
  repro: { payload: string; target: string; expected: string };
  closed: boolean;
}

interface RunDetail {
  runId: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  target: string;
  goal: string;
  iterations: number;
  findings: Finding[];
  patches: unknown[];
  retests: unknown[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/15 text-green-400 border-green-500/30',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const OWASP_COLORS: Record<string, string> = {
  LLM01: 'text-red-400', LLM02: 'text-orange-400', LLM03: 'text-yellow-400',
  LLM04: 'text-green-400', LLM05: 'text-blue-400', LLM06: 'text-violet-400',
  LLM07: 'text-purple-400', LLM08: 'text-pink-400', LLM09: 'text-slate-400', LLM10: 'text-white',
};

const OWASP_LABELS: Record<string, string> = {
  LLM01: 'Prompt Injection', LLM02: 'Insecure Output', LLM03: 'Training Data Poisoning',
  LLM04: 'Model DoS', LLM05: 'Supply Chain', LLM06: 'Excessive Agency',
  LLM07: 'System Prompt Leak', LLM08: 'Embedding Weaknesses', LLM09: 'Misinformation', LLM10: 'Model Theft',
};

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then(setRun)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">Run not found.</p>
        <Link href="/dashboard/runs" className="text-emerald-400 text-sm hover:underline mt-2 inline-block">
          Back to runs
        </Link>
      </div>
    );
  }

  const openFindings = run.findings.filter((f) => !f.closed);
  const closedFindings = run.findings.filter((f) => f.closed);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/dashboard/runs"
          className="mt-1 p-2 rounded-lg bg-midnight-700 border border-midnight-600 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white font-mono">{run.runId.slice(0, 16)}…</h1>
            <span className={clsx(
              'px-2 py-0.5 rounded text-xs font-bold border',
              run.status === 'complete' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
              run.status === 'partial' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
              'bg-red-500/15 text-red-400 border-red-500/30'
            )}>
              {run.status.toUpperCase()}
            </span>
            <a
              href={`/api/runs/${run.runId}/sarif`}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border border-cyan-500/40 text-cyan-300 bg-midnight-700 hover:border-cyan-400 hover:text-cyan-200 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              SARIF 2.1.0
            </a>
            {(['json', 'markdown', 'html', 'text'] as const).map((fmt) => (
              <a
                key={fmt}
                href={`/api/report/${run.runId}?format=${fmt}&download=1`}
                className="px-3 py-1 rounded text-xs font-semibold border border-midnight-600 text-slate-400 bg-midnight-700 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
              >
                {fmt.toUpperCase()}
              </a>
            ))}
          </div>
          <p className="text-slate-400 text-sm mt-1">{run.goal}</p>
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Target', value: run.target, icon: Shield },
          { label: 'Iterations', value: String(run.iterations), icon: Clock },
          { label: 'Open Findings', value: String(openFindings.length), icon: AlertTriangle, color: 'text-orange-400' },
          { label: 'Closed Findings', value: String(closedFindings.length), icon: CheckCircle, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={clsx('w-4 h-4', color ?? 'text-slate-400')} />
              <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-lg font-bold text-white font-mono truncate" title={value}>{value}</p>
          </div>
        ))}
      </div>

      {/* Findings */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Findings
          {run.findings.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({openFindings.length} open, {closedFindings.length} closed)
            </span>
          )}
        </h2>

        {run.findings.length === 0 ? (
          <div className="card-glass rounded-xl p-8 text-center text-slate-500">
            No findings in this run.
          </div>
        ) : (
          <div className="space-y-3">
            {run.findings.map((finding) => {
              const isSelected = selectedFinding === finding.id;
              return (
                <div
                  key={finding.id}
                  className={clsx(
                    'card-glass rounded-xl overflow-hidden border transition-all',
                    isSelected ? 'border-emerald-500/30' : 'border-midnight-700',
                  )}
                >
                  <button
                    className="w-full px-5 py-4 flex items-center gap-3 text-left"
                    onClick={() => setSelectedFinding(isSelected ? null : finding.id)}
                  >
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-bold border uppercase',
                      SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.info
                    )}>
                      {finding.severity}
                    </span>
                    <span className={clsx('font-mono text-sm font-bold', OWASP_COLORS[finding.owaspId] ?? 'text-white')}>
                      {finding.owaspId}
                    </span>
                    <span className="text-slate-200 text-sm flex-1 truncate">{finding.title}</span>
                    {finding.closed && (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    )}
                  </button>

                  {isSelected && (
                    <div className="px-5 pb-5 border-t border-midnight-700 pt-4 space-y-4 animate-slide-up">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">OWASP Category</p>
                        <p className={clsx('font-mono text-sm font-bold', OWASP_COLORS[finding.owaspId] ?? 'text-white')}>
                          {finding.owaspId} — {OWASP_LABELS[finding.owaspId] ?? finding.owaspId}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reproduction Payload</p>
                        <pre className="bg-midnight-950 rounded-lg p-3 text-sm text-red-300 font-mono overflow-x-auto">
                          {finding.repro.payload}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Evidence</p>
                        <pre className="bg-midnight-950 rounded-lg p-3 text-sm text-slate-300 font-mono overflow-x-auto">
                          {finding.evidence || '(no evidence captured)'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
