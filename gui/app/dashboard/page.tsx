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

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="card-glass rounded-xl p-5 flex items-start gap-4 animate-slide-up">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white font-mono">{value}</p>
        <p className="text-sm text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-severity-critical text-red-300',
    high: 'bg-severity-high text-orange-200',
    medium: 'bg-severity-medium text-yellow-200',
    low: 'bg-severity-low text-green-200',
    info: 'bg-severity-info text-blue-200',
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-bold uppercase', map[severity] ?? 'bg-slate-700 text-slate-300')}>
      {severity}
    </span>
  );
}

function OWaspBadge({ id }: { id: string }) {
  const colorMap: Record<string, string> = {
    LLM01: 'text-red-400', LLM02: 'text-orange-400', LLM03: 'text-yellow-400',
    LLM04: 'text-green-400', LLM05: 'text-blue-400', LLM06: 'text-violet-400',
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
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Overview</h1>
          <p className="text-slate-400 text-sm mt-1">
            OWASP LLM Top 10 — Multi-Agent Security Auditor
          </p>
        </div>
        <Link
          href="/dashboard/scan"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Activity className="w-4 h-4" />
          New Scan
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Runs"
          value={loading ? '—' : (stats?.totalRuns ?? 0)}
          icon={Shield}
          color="bg-emerald-500/10 text-emerald-400"
          sub="across all targets"
        />
        <StatCard
          label="Total Findings"
          value={loading ? '—' : (stats?.totalFindings ?? 0)}
          icon={AlertTriangle}
          color="bg-red-500/10 text-red-400"
          sub="discovered"
        />
        <StatCard
          label="Open"
          value={loading ? '—' : (stats?.openFindings ?? 0)}
          icon={Clock}
          color="bg-orange-500/10 text-orange-400"
          sub="require attention"
        />
        <StatCard
          label="Closed"
          value={loading ? '—' : (stats?.closedFindings ?? 0)}
          icon={CheckCircle}
          color="bg-green-500/10 text-green-400"
          sub="remediated"
        />
      </div>

      {/* Recent Runs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Runs</h2>
          <Link href="/dashboard/runs" className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="card-glass rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading runs...</div>
          ) : !stats?.recentRuns.length ? (
            <div className="p-8 text-center">
              <p className="text-slate-400">No scans yet.</p>
              <Link href="/dashboard/scan" className="text-emerald-400 text-sm hover:underline mt-2 inline-block">
                Run your first scan →
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-midnight-700">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Run</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Goal</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Findings</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-700">
                {stats.recentRuns.map((run) => (
                  <tr key={run.runId} className="hover:bg-midnight-700/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono text-emerald-400">{run.runId.slice(0, 16)}…</p>
                      <p className="text-xs text-slate-500 mt-0.5">{run.target}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-200 max-w-xs truncate">{run.goal}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-bold',
                        run.status === 'complete' ? 'bg-green-500/15 text-green-400' :
                        run.status === 'partial' ? 'bg-orange-500/15 text-orange-400' :
                        'bg-red-500/15 text-red-400'
                      )}>
                        {run.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 items-center">
                        {run.openCount > 0 && (
                          <span className="text-xs font-bold text-orange-400">{run.openCount} open</span>
                        )}
                        {run.closedCount > 0 && (
                          <span className="text-xs font-bold text-green-400">{run.closedCount} closed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs text-slate-400">
                        {new Date(run.startedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-600">
                        {new Date(run.startedAt).toLocaleTimeString()}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* OWASP Categories quick reference */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">OWASP LLM Categories</h2>
        <div className="grid grid-cols-5 gap-3">
          {['LLM01','LLM02','LLM03','LLM04','LLM05','LLM06','LLM07','LLM08','LLM09','LLM10'].map((id) => (
            <div key={id} className="card-glass rounded-lg px-4 py-3 flex items-center gap-2">
              <OWaspBadge id={id} />
              <span className="text-xs text-slate-400 truncate">
                {id === 'LLM01' ? 'Prompt Injection' :
                 id === 'LLM02' ? 'Insecure Output' :
                 id === 'LLM03' ? 'Training Data Poison' :
                 id === 'LLM04' ? 'Model DoS' :
                 id === 'LLM05' ? 'Supply Chain' :
                 id === 'LLM06' ? 'Excessive Agency' :
                 id === 'LLM07' ? 'System Prompt Leak' :
                 id === 'LLM08' ? 'Embedding Weak.' :
                 id === 'LLM09' ? 'Misinformation' :
                 'Model Theft'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
