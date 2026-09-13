/** Wide divider used as section rules across the CLI. */
export declare const DIVIDER: string;
/** Indented gradient banner block (re-exported so callers can print raw). */
export declare const BANNER: string;
export declare function shouldPrintBanner(): boolean;
/**
 * Reset the dedupe latch after a console.clear() — the scrollback (and any
 * banner in it) is gone, so the next printBanner() must render again.
 * Used by the interactive wizard, which starts from a fresh screen.
 */
export declare function resetBannerForInteractive(): void;
/** Print the flagship CYBERPULSE / AUDITOR block-art banner (guarded). */
export declare function printBanner(): void;
/**
 * Print the interactive mode-selection menu.
 * Shown when `cyberpulse` is run with no subcommand. Interactive menu
 * implies a human at a terminal — always renders.
 */
export declare function printInteractiveMenu(): void;
/** Status icons — inline width (callers own the indentation). */
export declare const STATUS: {
    readonly info: string;
    readonly success: string;
    readonly warn: any;
    readonly error: string;
    readonly critical: string;
    readonly pending: string;
    readonly running: string;
    readonly tick: string;
    readonly cross: string;
};
/** OWASP severity → chalk color function */
export declare const SEVERITY_COLOR: Record<string, (s: string) => string>;
/** OWASP category → chalk color function */
export declare const OWASP_COLOR: Record<string, (s: string) => string>;
