/** Divider line */
export declare const DIVIDER: string;
export declare function printBanner(): void;
/**
 * Print the interactive mode-selection menu.
 * Shown when `cyberpulse` is run with no subcommand.
 */
export declare function printInteractiveMenu(): void;
/** Status icons */
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
