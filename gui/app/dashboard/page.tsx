'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';
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

interface DashboardStats {
  totalRuns: number;
  totalFindings: number;
  openFindings: number;
  closedFindings: number;
  recentRuns: RunSummary[];
}

function StatCard({ label, value, icon: Icon, color, sub, loading }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="card-glass rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 animate-slide-up">
      <div className={clsx('w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="skeleton h-7 w-14 mb-1.5" aria-label="Loading value" />
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-white font-mono">{value}</p>
        )}
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-severity-critical text-red-300',
    high: 'bg-severity-high text-amber-200',
    medium: 'bg-severity-medium text-yellow-200',
    low: 'bg-severity-low text-emerald-200',
    info: 'bg-severity-info text-sky-200',
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-bold uppercase', map[severity] ?? 'bg-obsidian-700 text-slate-300')}>
      {severity}
    </span>
  );
}

function OWaspBadge({ id }: { id: string }) {
  const colorMap: Record<string, string> = {
    LLM01: 'text-red-400', LLM02: 'text-amber-400', LLM03: 'text-yellow-400',
    LLM04: 'text-green-400', LLM05: 'text-sky-400', LLM06: 'text-violet-400',
    LLM07: 'text-purple-400', LLM08: 'text-pink-400', LLM09: 'text-slate-400', LLM10: 'text-white',
  };
  return (
    <span className={clsx('font-mono text-xs font-bold', colorMap[id] ?? 'text-white')}>
      {id}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((data) => {
        const runs: RunSummary[] = data.runs ?? [];
        setStats({
          totalRuns: runs.length,
          totalFindings: runs.reduce((s, r) => s + r.findingsCount, 0),
          openFindings: runs.reduce((s, r) => s + r.openCount, 0),
          closedFindings: runs.reduce((s, r) => s + r.closedCount, 0),
          recentRuns: runs.slice(0, 5),
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Security Overview</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            OWASP LLM Top 10 — Multi-Agent Security Auditor
          </p>
        </div>
        <Link
          href="/dashboard/scan"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-obsidian-900 text-sm font-semibold transition-all shadow-lg shadow-amber-500/20 w-full sm:w-auto"
        >
          <Activity className="w-4 h-4" />
          New Scan
        </Link>
      </div>

      {/* Stats grid — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Runs"
          value={loading ? '—' : (stats?.totalRuns ?? 0)}
          icon={Shield}
          color="bg-amber-500/10 text-amber-400"
          sub="across all targets"
          loading={loading}
        />
        <StatCard
          label="Total Findings"
          value={loading ? '—' : (stats?.totalFindings ?? 0)}
          icon={AlertTriangle}
          color="bg-red-500/10 text-red-400"
          sub="discovered"
          loading={loading}
        />
        <StatCard
          label="Open"
          value={loading ? '—' : (stats?.openFindings ?? 0)}
          icon={Clock}
          color="bg-orange-500/10 text-orange-400"
          sub="require attention"
          loading={loading}
        />
        <StatCard
          label="Closed"
          value={loading ? '—' : (stats?.closedFindings ?? 0)}
          icon={CheckCircle}
          color="bg-emerald-500/10 text-emerald-400"
          sub="remediated"
          loading={loading}
        />
      </div>

      {/* Recent Runs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">Recent Runs</h2>
          <Link href="/dashboard/runs" className="text-xs sm:text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="card-glass rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-4 sm:p-8 space-y-3" aria-busy="true">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : !stats?.recentRuns.length ? (
            <div className="p-6 sm:p-8 text-center">
              <p className="text-slate-400 text-sm">No scans yet.</p>
              <Link href="/dashboard/scan" className="text-amber-400 text-sm hover:underline mt-2 inline-block">
                Run your first scan →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="responsive-table w-full min-w-[600px] lg:min-w-0">
                <thead>
                  <tr className="border-b border-obsidian-700">
                    <th className="text-left px-4 sm:px-5 py-3 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Run</th>
                    <th className="text-left px-4 sm:px-5 py-3 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Goal</th>
                    <th className="text-left px-4 sm:px-5 py-3 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 sm:px-5 py-3 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Findings</th>
                    <th className="text-left px-4 sm:px-5 py-3 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-700">
                  {stats.recentRuns.map((run) => (
                    <tr key={run.runId} className="hover:bg-obsidian-700/40 transition-colors">
                      <td data-label="Run" className="px-4 sm:px-5 py-4">
                        <p className="text-xs font-mono text-amber-400">{run.runId.slice(0, 14)}…</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">{run.target}</p>
                      </td>
                      <td data-label="Goal" className="px-4 sm:px-5 py-4">
                        <p className="text-xs sm:text-sm text-slate-200 max-w-[180px] sm:max-w-xs truncate">{run.goal}</p>
                      </td>
                      <td data-label="Status" className="px-4 sm:px-5 py-4">
                        <span className={clsx(
                          'px-2 py-1 rounded text-[10px] sm:text-xs font-bold border whitespace-nowrap',
                          run.status === 'complete' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          run.status === 'partial' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                          'bg-red-500/15 text-red-400 border-red-500/30'
                        )}>
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td data-label="Findings" className="px-4 sm:px-5 py-4">
                        <div className="flex flex-wrap gap-2 items-center">
                          {run.openCount > 0 && (
                            <span className="text-[10px] sm:text-xs font-bold text-amber-400">{run.openCount} open</span>
                          )}
                          {run.closedCount > 0 && (
                            <span className="text-[10px] sm:text-xs font-bold text-emerald-400">{run.closedCount} closed</span>
                          )}
                          {run.findingsCount === 0 && (
                            <span className="text-[10px] sm:text-xs text-slate-500">None</span>
                          )}
                        </div>
                      </td>
                      <td data-label="Date" className="px-4 sm:px-5 py-4">
                        <p className="text-[10px] sm:text-xs text-slate-400 whitespace-nowrap">
                          {new Date(run.startedAt).toLocaleDateString()}
                          <span className="block text-slate-600">{new Date(run.startedAt).toLocaleTimeString()}</span>
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* OWASP Categories quick reference */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4">OWASP LLM Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {[
            { id: 'LLM01', label: 'Prompt Injection' },
            { id: 'LLM02', label: 'Insecure Output' },
            { id: 'LLM03', label: 'Training Data' },
            { id: 'LLM04', label: 'Model DoS' },
            { id: 'LLM05', label: 'Supply Chain' },
            { id: 'LLM06', label: 'Excessive Agency' },
            { id: 'LLM07', label: 'System Prompt Leak' },
            { id: 'LLM08', label: 'Embeddings' },
            { id: 'LLM09', label: 'Misinformation' },
            { id: 'LLM10', label: 'Model Theft' },
          ].map(({ id, label }) => (
            <div key={id} className="card-glass rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2">
              <OWaspBadge id={id} />
              <span className="text-[10px] sm:text-xs text-slate-400 truncate">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
