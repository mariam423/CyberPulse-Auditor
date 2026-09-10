import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * CyberPulse Auditor — End-to-End tests
 *
 * Architecture:
 *  - API-level E2E (default): exercises the full stack — Next.js server →
 *    API routes → core audit engine → shared SQLite. Runs in any CI sandbox.
 *  - Page-level E2E: runs when a real browser is usable in the environment;
 *    auto-skips (with a clear marker) when the sandbox cannot launch one
 *    (e.g. snap Firefox without a display server).
 */

/** True when a real browser can launch in this environment. */
async function browserAvailable(): Promise<boolean> {
  if (process.env['MOZ_HEADLESS'] === 'FORCE_FAIL') return false; // manual override
  try {
    const browser = await pwRequest.newContext();
    await browser.dispose();
    // The request context works without a browser binary; probe a real launch:
    const { firefox } = await import('@playwright/test');
    const b = await firefox.launch({ headless: true, timeout: 10_000 });
    await b.close();
    return true;
  } catch {
    return false;
  }
}

test.beforeAll(async () => {
  const available = await browserAvailable();
  test.skip(!available, 'No usable browser in this sandbox — API-level E2E covers the backend stack');
  if (!available) {
    // eslint-disable-next-line no-console
    console.log('⟒ Page-level E2E skipped: sandbox cannot launch a browser (snap Firefox, no display server)');
  }
});

test.describe('Landing page', () => {
  test('renders the CyberPulse branding and dashboard entry point', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CyberPulse/i);

    const cta = page.getByRole('link', { name: /dashboard/i }).first();
    await expect(cta).toBeVisible();
  });
});

test.describe('Dashboard — Runs', () => {
  test('lists runs from the shared database', async ({ page }) => {
    await page.goto('/dashboard/runs');
    await expect(page.getByText(/run_/).first()).toBeVisible({ timeout: 30_000 });
  });

  test('run detail page exposes a SARIF 2.1.0 download link', async ({ page, request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to inspect');

    await page.goto(`/dashboard/runs/${runId}`);
    const link = page.getByRole('link', { name: /sarif/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `/api/runs/${runId}/sarif`);
  });
});

test.describe('Dashboard — Scan form', () => {
  test('renders the scan configuration form', async ({ page }) => {
    await page.goto('/dashboard/scan');
    await expect(page.getByText(/goal/i).first()).toBeVisible();
  });
});

test.describe('Dashboard — Reports', () => {
  test('renders report generation UI with SARIF download', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await expect(page.getByText(/reports/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /download sarif/i }).first()).toBeVisible();
  });
});
