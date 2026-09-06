/**
 * Severity color palette (theme-aware via CSS variables).
 * Critical → red, High → orange, Medium → yellow, Low → green, Info → blue.
 */
const SEVERITY_COLOR = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    info: '#3b82f6',
};
const SEVERITY_LABEL = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Info',
};
function severityBadge(severity) {
    const color = SEVERITY_COLOR[severity] ?? '#6b7280';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;color:#fff;background:${color};">${SEVERITY_LABEL[severity] ?? severity}</span>`;
}
function statusIcon(closed) {
    return closed
        ? '<span style="color:#22c55e;font-size:16px;">✓</span>'
        : '<span style="color:#ef4444;font-size:16px;">✗</span>';
}
function findingsSummary(report) {
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    const rows = severities.map((sev) => {
        const count = report.findings.filter((f) => f.severity === sev).length;
        const color = SEVERITY_COLOR[sev];
        return `<tr>
      <td style="padding:8px 16px;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};"></span></td>
      <td style="padding:8px 16px;color:#9ca3af;">${SEVERITY_LABEL[sev]}</td>
      <td style="padding:8px 16px;font-weight:600;">${count}</td>
    </tr>`;
    }).join('');
    const openCount = report.findings.filter((f) => !f.closed).length;
    const closedCount = report.findings.filter((f) => f.closed).length;
    return `
  <section style="margin:32px 0;">
    <h2 style="font-size:18px;font-weight:700;color:#f3f4f6;margin:0 0 16px;">Findings Summary</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="background:#1f2937;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#374151;">
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Severity</th>
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Count</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="background:#1f2937;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#9ca3af;font-size:14px;">Open Findings</span>
            <span style="font-size:28px;font-weight:700;color:#ef4444;">${openCount}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#9ca3af;font-size:14px;">Closed Findings</span>
            <span style="font-size:28px;font-weight:700;color:#22c55e;">${closedCount}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#9ca3af;font-size:14px;">Patches</span>
            <span style="font-size:28px;font-weight:700;color:#3b82f6;">${report.patches.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#9ca3af;font-size:14px;">Iterations</span>
            <span style="font-size:28px;font-weight:700;color:#a78bfa;">${report.iterations}</span>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}
function findingDetail(f) {
    const badge = severityBadge(f.severity);
    const status = statusIcon(f.closed);
    const statusLabel = f.closed ? 'Closed' : 'Open';
    const statusColor = f.closed ? '#22c55e' : '#ef4444';
    const closedBy = f.closedBy ? `<span style="color:#9ca3af;font-size:12px;">Closed by: <code style="background:#374151;padding:1px 6px;border-radius:4px;">${f.closedBy}</code></span>` : '';
    const evidenceLines = f.evidence.split('\n').map((l) => `<div style="font-family:monospace;font-size:12px;color:#d1d5db;white-space:pre-wrap;word-break:break-all;padding:2px 0;">${escapeHtml(l)}</div>`).join('');
    const reproPayload = escapeHtml(f.repro.payload.slice(0, 200));
    const reproExpected = escapeHtml(f.repro.expected);
    return `
  <details style="background:#1f2937;border-radius:12px;margin:12px 0;overflow:hidden;border:1px solid #374151;">
    <summary style="padding:16px 20px;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:12px;">
      ${status}
      <span style="font-weight:600;color:#f3f4f6;font-size:14px;">[${f.owaspId}]</span>
      <span style="color:#e5e7eb;font-size:14px;">${escapeHtml(f.title)}</span>
      ${badge}
      <span style="margin-left:auto;font-size:12px;font-weight:600;color:${statusColor};">${statusLabel}</span>
    </summary>
    <div style="padding:0 20px 20px;border-top:1px solid #374151;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
        <div>
          <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Finding ID</p>
          <code style="color:#a5b4fc;font-size:13px;">${escapeHtml(f.id)}</code>
          ${closedBy ? `<div style="margin-top:6px;">${closedBy}</div>` : ''}
        </div>
        <div>
          <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Target</p>
          <code style="color:#a5b4fc;font-size:13px;">${escapeHtml(f.repro.target)}</code>
        </div>
      </div>

      <div style="margin-top:16px;">
        <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Evidence</p>
        <div style="background:#111827;border-radius:8px;padding:12px;overflow-x:auto;">${evidenceLines}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
        <div>
          <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Attack Payload</p>
          <code style="color:#fbbf24;font-size:12px;word-break:break-all;">${reproPayload || '(empty)'}</code>
        </div>
        <div>
          <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Expected Result</p>
          <span style="color:#d1d5db;font-size:13px;">${reproExpected}</span>
        </div>
      </div>
    </div>
  </details>`;
}
function patchDetail(p) {
    const appliedIcon = p.applied
        ? '<span style="color:#22c55e;font-size:14px;">✓ Applied</span>'
        : '<span style="color:#f97316;font-size:14px;">◐ Proposed</span>';
    const restartNote = p.requiresRestart
        ? '<span style="color:#eab308;font-size:12px;margin-left:8px;">⚠ restart required</span>'
        : '';
    return `
  <div style="background:#1f2937;border-radius:12px;margin:10px 0;padding:16px 20px;border:1px solid #374151;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-family:monospace;font-size:13px;color:#a5b4fc;background:#374151;padding:2px 8px;border-radius:4px;">${escapeHtml(p.owaspId)}</span>
      <span style="color:#e5e7eb;font-size:14px;font-weight:600;">${escapeHtml(p.kind)} patch</span>
      ${appliedIcon}
      ${restartNote}
    </div>
    <p style="color:#d1d5db;font-size:13px;margin:0 0 10px;line-height:1.6;">${escapeHtml(p.rationale)}</p>
    <div style="display:flex;gap:16px;">
      <div style="flex:1;">
        <p style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Finding ID</p>
        <code style="color:#6b7280;font-size:12px;">${escapeHtml(p.findingId)}</code>
      </div>
      <div style="flex:1;">
        <p style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Patch ID</p>
        <code style="color:#6b7280;font-size:12px;">${escapeHtml(p.id)}</code>
      </div>
    </div>
  </div>`;
}
function retestDetail(r) {
    const icon = r.verdict === 'closed' ? '✓' : r.verdict === 'open' ? '✗' : '?';
    const color = r.verdict === 'closed' ? '#22c55e' : r.verdict === 'open' ? '#ef4444' : '#eab308';
    return `
  <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #374151;">
    <span style="font-size:18px;color:${color};">${icon}</span>
    <div>
      <span style="font-family:monospace;font-size:13px;color:#a5b4fc;">${escapeHtml(r.findingId)}</span>
      <span style="color:#9ca3af;font-size:13px;margin-left:8px;">${r.verdict} · ${r.attemptsCount} attempt(s)</span>
    </div>
  </div>
  <div style="padding:8px 0 16px 30px;">
    <pre style="color:#6b7280;font-size:12px;white-space:pre-wrap;word-break:break-all;margin:0;">${escapeHtml(r.evidence)}</pre>
  </div>`;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function escapeAttr(s) {
    return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/**
 * Format a CyberPulse run report as a self-contained, theme-aware HTML page.
 * No external dependencies except Google Fonts (optional).
 */
export function formatHtml(report) {
    const openFindings = report.findings.filter((f) => !f.closed);
    const closedFindings = report.findings.filter((f) => f.closed);
    const statusColor = report.status === 'complete' ? '#22c55e' :
        report.status === 'error' ? '#ef4444' : '#f97316';
    const runStatusBadge = report.status === 'complete' ? 'Complete' :
        report.status === 'error' ? 'Error' : 'Partial';
    const findingsDetails = report.findings.map(findingDetail).join('');
    const patchesDetails = report.patches.map(patchDetail).join('');
    const retestsDetails = report.retests.map(retestDetail).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CyberPulse Report — ${escapeHtml(report.runId)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --border: #334155;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #6366f1;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --surface: #ffffff;
        --border: #e2e8f0;
        --text: #0f172a;
        --text-muted: #64748b;
        --accent: #4f46e5;
      }
    }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
    /* Header */
    .report-header { border-bottom: 1px solid var(--border); padding-bottom: 32px; margin-bottom: 32px; }
    .report-title { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: var(--text); letter-spacing: -0.02em; }
    .report-subtitle { color: var(--text-muted); font-size: 13px; margin: 0; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-top: 20px; }
    .meta-item { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
    .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0 0 4px; }
    .meta-value { font-size: 14px; font-weight: 600; color: var(--text); margin: 0; word-break: break-all; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44; }
    /* Sections */
    h2 { font-size: 16px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
    .section-desc { color: var(--text-muted); font-size: 13px; margin: 0 0 16px; }
    .section { margin: 40px 0; }
    /* Footer */
    .footer { border-top: 1px solid var(--border); padding-top: 24px; margin-top: 48px; color: var(--text-muted); font-size: 12px; text-align: center; }
    .footer a { color: var(--accent); text-decoration: none; }
    code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
    pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; overflow-x: auto; }
    @media (max-width: 600px) {
      .meta-grid { grid-template-columns: 1fr 1fr; }
      .container { padding: 24px 16px; }
    }
  </style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <header class="report-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <h1 class="report-title">CyberPulse Security Report</h1>
        <p class="report-subtitle">OWASP LLM Top 10 Security Audit</p>
      </div>
      <div class="status-badge">
        <span style="width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block;"></span>
        ${runStatusBadge}
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <p class="meta-label">Run ID</p>
        <p class="meta-value" style="font-size:12px;">${escapeHtml(report.runId)}</p>
      </div>
      <div class="meta-item">
        <p class="meta-label">Target</p>
        <p class="meta-value" style="font-size:12px;">${escapeHtml(report.target)}</p>
      </div>
      <div class="meta-item">
        <p class="meta-label">Goal</p>
        <p class="meta-value" style="font-size:12px;">${escapeHtml(report.goal)}</p>
      </div>
      <div class="meta-item">
        <p class="meta-label">Iterations</p>
        <p class="meta-value">${report.iterations}</p>
      </div>
      <div class="meta-item">
        <p class="meta-label">Started</p>
        <p class="meta-value" style="font-size:12px;">${escapeHtml(report.startedAt)}</p>
      </div>
      <div class="meta-item">
        <p class="meta-label">Finished</p>
        <p class="meta-value" style="font-size:12px;">${escapeHtml(report.finishedAt)}</p>
      </div>
    </div>
  </header>

  <!-- Findings Summary -->
  ${findingsSummary(report)}

  <!-- Open Findings -->
  ${openFindings.length > 0 ? `
  <section class="section">
    <h2>Open Findings (${openFindings.length})</h2>
    <p class="section-desc">Findings that have not yet been closed by a remediation patch.</p>
    ${openFindings.map(findingDetail).join('')}
  </section>` : ''}

  <!-- Closed Findings -->
  ${closedFindings.length > 0 ? `
  <section class="section">
    <h2>Closed Findings (${closedFindings.length})</h2>
    <p class="section-desc">Findings remediated by defender patches.</p>
    ${closedFindings.map(findingDetail).join('')}
  </section>` : ''}

  <!-- Patches -->
  ${report.patches.length > 0 ? `
  <section class="section">
    <h2>Remediation Patches (${report.patches.length})</h2>
    <p class="section-desc">Patches generated by the defender agent to close findings.</p>
    ${patchesDetails}
  </section>` : ''}

  <!-- Retests -->
  ${report.retests.length > 0 ? `
  <section class="section">
    <h2>Retest Results (${report.retests.length})</h2>
    <p class="section-desc">Validation results confirming or rejecting patch effectiveness.</p>
    ${retestsDetails}
  </section>` : ''}

  <!-- Footer -->
  <footer class="footer">
    <p>Generated by <strong>CyberPulse Auditor</strong> v0.1.0 &mdash; Multi-Agent LLM Security Copilot</p>
    <p>Based on <a href="https://owasp.org/www-project-top-10-for-llm-applications/">OWASP Top 10 for LLM Applications</a></p>
  </footer>

</div>
</body>
</html>`;
}
//# sourceMappingURL=html.js.map