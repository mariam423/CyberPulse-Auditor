import type { RunReport } from './types.js';
/**
 * Format a CyberPulse run report as a terminal-friendly text report.
 * Uses ANSI color codes for readability in the terminal.
 */
export declare function formatTextReport(report: RunReport): string;
