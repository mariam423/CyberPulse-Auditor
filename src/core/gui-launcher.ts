/**
 * CyberPulse Core — GUI Launcher
 *
 * Spawns the Next.js GUI dashboard as a child process.
 * Both CLI and API can call this with full parity — the same
 * Next.js server is started whether you run `cyberpulse gui` or
 * access it via the web dashboard.
 */

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface GuiLaunchOptions {
  port?: number;
  open?: boolean;      // open browser automatically
  detached?: boolean;  // run server detached (CLI background mode)
}

interface GuiServer {
  port: number;
  url: string;
  proc?: ReturnType<typeof spawn>;
  promise?: Promise<void>;
}

/** Detect if a port is already in use (lightweight check) */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: '127.0.0.1', timeout: 500 });
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

/**
 * Launch the Next.js GUI dashboard.
 * Returns the server info; call server.promise to wait for ready.
 */
export async function launchGui(options: GuiLaunchOptions = {}): Promise<GuiServer> {
  const port = options.port ?? 3000;
  const url = `http://localhost:${port}`;

  // Check if already running
  if (await isPortInUse(port)) {
    return { port, url };
  }

  // Resolve gui directory (src/core/ → project root → gui/)
  const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const guiDir = resolve(cliRoot, 'gui');
  const nextBin = resolve(guiDir, 'node_modules/.bin/next');

  // Verify GUI dependencies are installed
  if (!existsSync(nextBin)) {
    throw new Error(
      `GUI dependencies not found. Run:\n\n` +
      `  cd gui && npm install\n\n` +
      `Then launch the GUI again with:\n` +
      `  cyberpulse gui\n`
    );
  }

  const env = {
    ...process.env,
    PORT: String(port),
    CYBERPULSE_DB_PATH: process.env.CYBERPULSE_DB_PATH ?? 'data/cyberpulse.db',
  };

  // Build args for next dev
  const args = ['dev'];
  if (options.open) args.push('--open');

  // Use shell:false with direct binary path to avoid /bin/sh dependency issues
  const child = spawn(nextBin, args, {
    cwd: guiDir,
    env,
    stdio: 'inherit',
    shell: false,
  });

  const promise = waitForServer(port);

  if (options.detached) {
    child.unref();
    return { port, url };
  }

  return { port, url, proc: child, promise };
}

/** Wait until the Next.js dev server is responding on the given port. */
function waitForServer(port: number, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;

    function poll(): void {
      if (Date.now() > deadline) {
        reject(new Error(`GUI server did not start on port ${port} within ${timeout}ms`));
        return;
      }
      const sock = createConnection({ port, host: '127.0.0.1', timeout: 1000 });
      sock.on('connect', () => { sock.destroy(); resolve(); });
      sock.on('timeout', () => { sock.destroy(); setTimeout(poll, 500); });
      sock.on('error', () => { sock.destroy(); setTimeout(poll, 500); });
    }

    poll();
  });
}
