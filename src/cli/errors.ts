/**
 * CyberPulse CLI — Error Handling & UX
 *
 * Central error pipeline for the whole CLI. Every failure path funnels
 * through `emitError` / `installCrashGuards`, producing colored, human
 * feedback instead of raw stack traces:
 *
 *   ✖ CommandError   missing args, unknown flags, bad paths (exit 2)
 *   ✖ RunError       target/model failures mid-audit (exit 1)
 *   💥 Unexpected    crashes with a condensed stack (exit 1, --debug shows all)
 */

import chalk from 'chalk';
import { CommanderError } from 'commander';
import { z } from 'zod';

/** Exit codes — mirrors common CLI conventions (git, opencode, etc.). */
export const EXIT = {
  ok: 0,
  runError: 1,
  usageError: 2, // bad usage: missing/invalid arguments, unknown command
} as const;

/** Expected, user-facing usage error (missing arg, invalid path/flag). */
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

/** Expected runtime failure (target unreachable, model error, bad run id). */
export class RunError extends Error {
  constructor(
    message: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'RunError';
  }
}

/** A single, well-formatted zod issue line (no JSON dumps in the terminal). */
function formatZodIssue(issue: z.ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return `  ${chalk.gray('·')} ${chalk.cyan(path)} ${chalk.gray('→')} ${issue.message}`;
}

/** True when the raw message already looks like a friendly CLI line. */
function isFriendly(message: string): boolean {
  return /^\s*✖/.test(message);
}

/** Print any thrown value in the standard CyberPulse error style. */
export function emitError(err: unknown, _context?: string): void {
  if (err instanceof CommandError || err instanceof RunError) {
    printStyled(err.name === 'CommandError' ? '✖' : '✖', err.message, err.hint);
    return;
  }

  if (err instanceof CommanderError) {
    // commander already styled usage errors via exitOverride — never double-print.
    if (isFriendly(err.message)) return;
    printStyled('✖', err.message);
    return;
  }

  if (err instanceof z.ZodError) {
    printStyled('✖', 'Invalid option values:', undefined, err.errors.map(formatZodIssue).join('\n'));
    return;
  }

  if (err instanceof Error) {
    const stack = err.stack ?? '';
    const condensed = stack.split('\n').slice(0, 4).join('\n');
    printStyled('💥', `${err.message}`, undefined, chalk.gray(condensed));
    return;
  }

  printStyled('💥', String(err));
}

function printStyled(icon: string, message: string, hint?: string, detail?: string): void {
  console.error(`\n  ${chalk.bold.red(icon)}  ${chalk.bold.white(message)}`);
  if (detail) console.error(detail);
  if (hint) console.error(`\n  ${chalk.gray('›')} ${chalk.gray(hint)}`);
  console.error('');
}

/**
 * Install process-level crash guards. Call once from the entry point
 * BEFORE any async work so nothing can ever leak a raw stack trace.
 */
export function installCrashGuards(debug: boolean): void {
  process.on('uncaughtException', (err: Error) => {
    emitError(err, 'uncaughtException');
    process.exit(debug ? EXIT.runError : EXIT.runError);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    emitError(reason, 'unhandledRejection');
    process.exit(EXIT.runError);
  });
}

/**
 * Install Ctrl+C / SIGTERM handling: a second press force-quits, matching
 * the opencode-style interactive CLI contract.
 */
export function installSignalHandlers(): void {
  let interrupted = false;
  const handler = (signal: NodeJS.Signals) => {
    if (interrupted) {
      process.exit(130);
    }
    interrupted = true;
    console.error(`\n\n  ${chalk.bold.hex('#f97316')('⚠')}  ${chalk.gray(`Received ${signal} — press Ctrl+C again to force quit`)}`);
    // Give in-flight work (sqlite WAL flush, child procs) a moment.
    setTimeout(() => process.exit(130), 150).unref();
  };
  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
}
