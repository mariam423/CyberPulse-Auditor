import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'CyberPulse Auditor',
  description: 'Multi-Agent LLM Security Copilot — OWASP Top 10',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛡️</svg>',
  },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request headers makes the whole app dynamic — REQUIRED for
  // the nonce-based CSP middleware: pages prerendered at build time cannot
  // embed the per-request nonce, so React's inline bootstrap scripts would
  // be blocked and every page would render dead (no hydration).
  // The CSP header itself is set by middleware.ts.
  await headers();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-obsidian-900 text-slate-100 antialiased">
        {/* Subtle amber grid background */}
        <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden="true" />
        {/* Top accent bar — amber → emerald security gradient */}
        <div
          className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent pointer-events-none z-50"
          aria-hidden="true"
        />
        {children}
      </body>
    </html>
  );
}
