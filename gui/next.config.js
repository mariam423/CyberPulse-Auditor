/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing TypeScript from the shared core
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@core': ['../src/core'],
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
