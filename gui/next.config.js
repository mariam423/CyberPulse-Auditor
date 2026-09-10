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
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'CyberPulse Auditor',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
  },
};

module.exports = nextConfig;
