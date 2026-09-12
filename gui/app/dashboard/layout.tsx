'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Activity, FileText, LayoutDashboard, Radio, BookOpen, Gauge, Menu, X } from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/live', label: 'Live Telemetry', icon: Gauge },
  { href: '/dashboard/scan', label: 'New Scan', icon: Activity },
  { href: '/dashboard/runs', label: 'Run History', icon: Radio },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/onboarding', label: 'Get Started', icon: BookOpen },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen">
      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-obsidian-900/95 backdrop-blur border-b border-obsidian-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">CyberPulse</p>
            <p className="text-[10px] text-amber-400/80 leading-tight">Auditor v0.1.0</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-nav"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:bg-obsidian-700 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ── Mobile sidebar (drawer) ────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id="sidebar-nav"
        className={clsx(
          'lg:fixed fixed z-40 inset-y-0 left-0 w-72 max-w-[85vw] bg-obsidian-850 border-r border-obsidian-700 flex flex-col transition-transform duration-300 ease-in-out',
          // Desktop: always visible. Mobile: slide in/out.
          'lg:translate-x-0 lg:block',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Primary navigation"
      >
        {/* Logo (desktop) */}
        <div className="hidden lg:flex px-6 py-5 border-b border-obsidian-700 items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">CyberPulse</p>
            <p className="text-xs text-amber-400/70">Auditor v0.1.0</p>
          </div>
        </div>

        {/* Spacer for the mobile top bar */}
        <div className="lg:hidden h-14 border-b border-obsidian-700/60" aria-hidden="true" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-obsidian-700/60 border border-transparent'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-slow" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-obsidian-700">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Core Engine: Synced
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 min-h-screen min-w-0 lg:ml-64 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
