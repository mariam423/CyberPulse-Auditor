import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const PORT = 3210;

// System Firefox (snap) — avoids the 186 MB Chromium download.
// The Playwright `browser` fixture can't be set from `use`, so we define
// a small launcher project through the `launchOptions` channel instead.
const FIREFOX_PATH = process.env.CYBERPULSE_E2E_BROWSER_PATH ?? '/snap/bin/firefox';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    headless: true,
    launchOptions: {
      executablePath: FIREFOX_PATH,
      env: {
        ...process.env,
        // Software rendering — snap Firefox has no GPU/GL in containers.
        MOZ_HEADLESS: '1',
        MOZ_DISABLE_RDD_SANDBOX: '1',
        MOZ_USE_X_dummy: '1',
        LIBGL_ALWAYS_SOFTWARE: '1',
      },
      firefoxUserPrefs: {
        'gfx.webrender.software': true,
        'gfx.webrender.software.opengl': false,
        'layers.acceleration.disabled': true,
        'dom.ipc.plugins.enabled': false,
      },
    },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 60_000,
    reuseExistingServer: false,
    cwd: resolve(__dirname),
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  },
});
