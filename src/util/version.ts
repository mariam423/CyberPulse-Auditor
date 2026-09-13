/**
 * CyberPulse Auditor — version single-source-of-truth.
 *
 * `npm version` writes package.json; the build bakes this module via
 * `readFileSync` at compile time is intentionally avoided so the same
 * compiled dist works during development (repo checkout) and after
 * `npm pack` (tarball without package.json sibling). Instead, the
 * version literal is asserted equal to package.json by CI lint.
 *
 * When bumping: update package.json AND this constant together.
 */
export const VERSION = '0.1.0';

export const NAME = 'CyberPulse Auditor';

export const BANNER_VERSION = `v${VERSION}`;
