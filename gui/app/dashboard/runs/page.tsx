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
    complete: 'bg-green-500/15 text-green-400 border-green-500/30',
    partial: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    running: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    error: 'bg-red-500/15 text-red-400 border-red-500/30',
  }[status] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30');

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Run History</h1>
          <p className="text-slate-400 text-sm mt-1">All completed and in-progress audit runs</p>
        </div>
        <button
          onClick={fetchRuns}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-midnight-700 border border-midnight-600 text-slate-300 text-sm hover:border-emerald-500/30 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Runs table */}
      <div className="card-glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading runs...</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 mb-3">No audit runs yet.</p>
            <Link
              href="/dashboard/scan"
              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
            >
              Launch your first scan →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-700">
                {['Run ID', 'Goal', 'Target', 'Status', 'Findings', 'Started', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight-700">
              {runs.map((run) => (
                <tr key={run.runId} className="hover:bg-midnight-700/40 transition-colors group">
                  <td className="px-5 py-4">
                    <p className="text-xs font-mono text-emerald-400">{run.runId.slice(0, 16)}…</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-200 max-w-xs truncate">{run.goal}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-xs text-slate-400 max-w-xs truncate font-mono">{run.target}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={clsx('px-2 py-1 rounded text-xs font-bold border', statusBadge(run.status))}>
                      {run.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 items-center">
                      {run.openCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
                          <AlertTriangle className="w-3 h-3" />
                          {run.openCount} open
                        </span>
                      )}
                      {run.closedCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          {run.closedCount} closed
                        </span>
                      )}
                      {run.findingsCount === 0 && (
                        <span className="text-xs text-slate-500">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/runs/${run.runId}`}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
