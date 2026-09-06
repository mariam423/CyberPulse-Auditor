import type { RunReport } from './types.js';

/**
 * Format a CyberPulse run report as structured JSON.
 * The structure follows the RunReport type directly.
 */
export function formatJson(report: RunReport): string {
  return JSON.stringify(report, null, 2);
}
