import { NextRequest, NextResponse } from 'next/server';

/**
 * Nonce-based Content Security Policy middleware
 * ──────────────────────────────────────────────
 * Next.js App Router hydrates via INLINE <script> tags (the RSC payload
 * `self.__next_f.push(...)`). A static `script-src 'self'` header blocks
 * those, React never attaches, and every interactive element on every
 * page (copy buttons, OS tabs, forms) goes dead.
 *
 * The fix: a per-request cryptographic nonce. Next.js 14.2 automatically
 * reads the `x-nonce` header set here and stamps its inline scripts with
 * it, while 'strict-dynamic' lets them load the external chunk files.
 *
 * Reference: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */

// Real randomness (16 bytes → 22-char base64). Only Edge-compatible
// primitives are used — this runs on the Edge runtime in production.
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest) {
  const nonce = makeNonce();

  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' + nonce: inline RSC bootstrap scripts (nonce-stamped
    // by Next) are the only trust root; every chunk they load is allowed.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind: compile-time class extraction → runtime inline styles.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // Block mixed content and plugin embedding outright.
    `object-src 'none'`,
  ].join('; ');

  // Next.js 14.2's app-render reads the nonce from the INCOMING request's
  // Content-Security-Policy header (req.headers['content-security-policy'])
  // to stamp its inline RSC scripts. So the CSP must ride the request
  // headers — not just the response headers — for the two to match.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Static assets (_next/static/*) carry hashes in their filenames —
  // they don't need the CSP dance, and skipping them saves nonce work.
  // API routes never render HTML but keep the headers for defense-in-depth.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
