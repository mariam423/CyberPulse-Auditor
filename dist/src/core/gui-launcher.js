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
/** Detect if a port is already in use (lightweight check) */
function isPortInUse(port) {
    return new Promise((resolve) => {
        const sock = createConnection({ port, host: '127.0.0.1', timeout: 500 });
        sock.on('connect', () => { sock.destroy(); resolve(true); });
        sock.on('error', () => { sock.destroy(); resolve(false); });
        sock.on('timeout', () => { sock.destroy(); resolve(false); });
    });
}
/**
 * Open a URL in the default browser using the appropriate platform command.
 * Falls back silently if no browser is available.
 */
function openBrowser(url) {
    const isWindows = process.platform === 'win32';
    const openCmd = isWindows ? 'start' : 'xdg-open';
    try {
        spawn(openCmd, [url], { detached: true, stdio: 'ignore', shell: true }).unref();
    }
    catch {
        // Silently ignore if browser can't be opened
    }
}
/**
 * Launch the Next.js GUI dashboard.
 * Returns the server info; call server.promise to wait for ready.
 */
export async function launchGui(options = {}) {
    const port = options.port ?? 3000;
    const url = `http://localhost:${port}`;
    // Check if already running
    if (await isPortInUse(port)) {
        if (options.open)
            openBrowser(url);
        return { port, url };
    }
    // Resolve gui directory:
    // dist/src/core/gui-launcher.js → up 3 levels to project root → gui/
    const launcherDir = dirname(fileURLToPath(import.meta.url));
    const guiDir = resolve(launcherDir, '../../../gui');
    const nextBin = resolve(guiDir, 'node_modules/.bin/next');
    // Verify GUI dependencies are installed
    if (!existsSync(nextBin)) {
        throw new Error(`GUI dependencies not found. Run:\n\n` +
            `  cd gui && npm install\n\n` +
            `Then launch the GUI again with:\n` +
            `  cyberpulse gui\n`);
    }
    const env = {
        ...process.env,
        PORT: String(port),
        // Absolute path so the GUI (cwd = gui/) shares the root database.
        CYBERPULSE_DB_PATH: process.env.CYBERPULSE_DB_PATH
            ? resolve(process.cwd(), process.env.CYBERPULSE_DB_PATH)
            : resolve(process.cwd(), 'data/cyberpulse.db'),
    };
    // Start next dev (no --open flag — we open the browser manually)
    const child = spawn(nextBin, ['dev', '--port', String(port)], {
        cwd: guiDir,
        env,
        stdio: 'inherit',
        shell: false,
    });
    // Wait for server to be ready, then optionally open browser
    const promise = (async () => {
        await waitForServer(port);
        if (options.open)
            openBrowser(url);
    })();
    if (options.detached) {
        child.unref();
        return { port, url };
    }
    return { port, url, proc: child, promise };
}
/** Wait until the Next.js dev server is responding on the given port. */
function waitForServer(port, timeout = 30_000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeout;
        function poll() {
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
//# sourceMappingURL=gui-launcher.js.map