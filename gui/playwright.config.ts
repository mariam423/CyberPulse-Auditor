import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const PORT = 3210;

// Playwright's bundled Chromium (downloaded to ~/.cache/ms-playwright).
// Falls back to the system snap Firefox via CYBERPULSE_E2E_BROWSER_PATH when
// the bundled browser is unavailable (e.g. offline CI with a pre-baked FF).
const CHROMIUM_PATH = resolve(
  process.env.HOME ?? '',
  '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
);
const FIREFOX_PATH = process.env.CYBERPULSE_E2E_BROWSER_PATH ?? '/snap/bin/firefox';

const useFirefox = process.env.CYBERPULSE_E2E_BROWSER === 'firefox';
const executablePath = useFirefox ? FIREFOX_PATH : CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
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
    ...(useFirefox
      ? {
          // snap Firefox: software rendering, no GPU/GL in containers
          launchOptions: {
            executablePath: FIREFOX_PATH,
            env: {
              ...process.env,
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
        }
      : {
          launchOptions: {
            // Bundled Chromium runs everywhere (incl. containers) out of the box
            executablePath: CHROMIUM_PATH,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
          },
        }),
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
