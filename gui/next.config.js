/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing TypeScript from the shared core (../src/**)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@core': '../src/core',
      '@report': '../src/report',
      '@shared': '../src',
    };
    // The backend uses NodeNext (".js"-suffixed) imports between TS files.
    // Map them back to their TypeScript sources for webpack.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  // ── SaaS security guardrails: hardened response headers ──────────────────
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent MIME-type sniffing on the API surface
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Full CORS lockdown — same-origin only
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js dev/build inline styles + the Google Fonts import in globals.css
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              // API routes are same-origin; no third-party script origins
              "script-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Strict Transport Security (behind TLS-terminating proxies in prod)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // API routes: never cached by shared/CDN caches (live security data)
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'CyberPulse Auditor',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
    // Installer widget — install-script host + npm package name
    NEXT_PUBLIC_INSTALL_SCRIPT_URL: process.env.NEXT_PUBLIC_INSTALL_SCRIPT_URL || 'https://cyberpulse.dev/install',
    NEXT_PUBLIC_NPM_PACKAGE: process.env.NEXT_PUBLIC_NPM_PACKAGE || 'cyberpulse-auditor',
  },
};

module.exports = nextConfig;
