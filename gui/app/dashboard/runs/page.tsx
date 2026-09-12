'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, CheckCircle, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
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

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = () => {
    setLoading(true);
    fetch('/api/runs')
      .then((r) => r.json())
      .then((data) => setRuns(data.runs ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const statusBadge = (status: string) => ({
    complete: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    partial: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    running: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    error: 'bg-red-500/15 text-red-400 border-red-500/30',
  }[status] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Run History</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">All completed and in-progress audit runs</p>
        </div>
        <button
          onClick={fetchRuns}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-obsidian-700 border border-obsidian-600 text-slate-300 text-sm hover:border-amber-500/40 hover:text-white transition-all w-full sm:w-auto"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Runs table → stacked cards on mobile */}
      <div className="card-glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 sm:p-12 space-y-3" aria-busy="true">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="p-6 sm:p-12 text-center">
            <p className="text-slate-400 mb-3 text-sm">No audit runs yet.</p>
            <Link
              href="/dashboard/scan"
              className="text-amber-400 hover:text-amber-300 text-sm font-medium"
            >
              Launch your first scan →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full min-w-[720px] lg:min-w-0">
              <thead>
                <tr className="border-b border-obsidian-700">
                  {['Run ID', 'Goal', 'Target', 'Status', 'Findings', 'Started', ''].map((h) => (
                    <th key={h} className="text-left px-4 sm:px-5 py-3 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-700">
                {runs.map((run) => (
                  <tr key={run.runId} className="hover:bg-obsidian-700/40 transition-colors group">
                    <td data-label="Run" className="px-4 sm:px-5 py-4">
                      <p className="text-xs font-mono text-amber-400">{run.runId.slice(0, 16)}…</p>
                    </td>
                    <td data-label="Goal" className="px-4 sm:px-5 py-4">
                      <p className="text-xs sm:text-sm text-slate-200 max-w-[160px] sm:max-w-xs truncate">{run.goal}</p>
                    </td>
                    <td data-label="Target" className="px-4 sm:px-5 py-4">
                      <p className="text-[10px] sm:text-xs text-slate-400 max-w-[140px] sm:max-w-xs truncate font-mono">{run.target}</p>
                    </td>
                    <td data-label="Status" className="px-4 sm:px-5 py-4">
                      <span className={clsx('px-2 py-1 rounded text-[10px] sm:text-xs font-bold border whitespace-nowrap', statusBadge(run.status))}>
                        {run.status.toUpperCase()}
                      </span>
                    </td>
                    <td data-label="Findings" className="px-4 sm:px-5 py-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        {run.openCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {run.openCount} open
                          </span>
                        )}
                        {run.closedCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            {run.closedCount} closed
                          </span>
                        )}
                        {run.findingsCount === 0 && (
                          <span className="text-[10px] sm:text-xs text-slate-500">None</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Started" className="px-4 sm:px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 whitespace-nowrap">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td data-label="" className="px-4 sm:px-5 py-4">
                      <Link
                        href={`/dashboard/runs/${run.runId}`}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
