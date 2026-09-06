import type { RunReport } from './types.js';
/**
 * Format a CyberPulse report as SARIF 2.1.0 JSON.
 * SARIF is the standard format for static analysis tools (used by GitHub, GitLab, etc.)
 */
export declare function formatSarif(report: RunReport): object;
