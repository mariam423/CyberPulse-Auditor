/**
 * CyberPulse Core — GUI Launcher
 *
 * Spawns the Next.js GUI dashboard as a child process.
 * Both CLI and API can call this with full parity — the same
 * Next.js server is started whether you run `cyberpulse gui` or
 * access it via the web dashboard.
 */
import { spawn } from 'node:child_process';
export interface GuiLaunchOptions {
    port?: number;
    open?: boolean;
    detached?: boolean;
}
interface GuiServer {
    port: number;
    url: string;
    proc?: ReturnType<typeof spawn>;
    promise?: Promise<void>;
}
/**
 * Launch the Next.js GUI dashboard.
 * Returns the server info; call server.promise to wait for ready.
 */
export declare function launchGui(options?: GuiLaunchOptions): Promise<GuiServer>;
export {};
