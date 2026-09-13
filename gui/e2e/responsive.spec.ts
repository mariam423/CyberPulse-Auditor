/**
 * Responsive layout e2e (single-launch batch)
 * ────────────────────────────────────────────
 * Verifies the CyberPulse UI never overflows across mobile, tablet,
 * desktop, and ultra-wide viewports.
 *
 * Strategy: ONE browser launch, ONE tab — iterate all (viewport × page)
 * combinations inside a single test. This environment's snap Firefox takes
 * minutes to cold-launch, so per-test launches are not viable; batching
 * keeps the full coverage at a fraction of the cost.
 *
 * Core assertion: document.scrollingElement.scrollWidth must never exceed
 * clientWidth — zero horizontal scroll — on every page at every breakpoint.
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile-sm', width: 360, height: 740 },   // small Android
  { name: 'mobile', width: 390, height: 844 },      // iPhone 12/13/14
  { name: 'tablet', width: 768, height: 1024 },     // iPad portrait
  { name: 'desktop', width: 1440, height: 900 },    // laptop
  { name: 'ultrawide', width: 2560, height: 1080 }, // ultra-wide
];

const PAGES = [
  '/download',
  '/dashboard',
  '/dashboard/live',
  '/dashboard/scan',
  '/dashboard/runs',
  '/dashboard/reports',
  '/dashboard/onboarding',
];

test('all pages: zero horizontal overflow at every viewport', async ({ page }) => {
  test.setTimeout(240_000);
  const failures: string[] = [];

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // networkidle is unreachable on /dashboard/live (3s telemetry polling)
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(500); // skeletons → content

      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });

      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        failures.push(
          `${vp.name} ${path}: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`
        );
      }
    }
  }

  expect(failures, `\nOverflow detected:\n${failures.join('\n')}`).toHaveLength(0);
});

test('mobile overview: no element extends beyond the viewport', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  // Every visible element's bounding box must fit within the viewport width.
  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === 'fixed') continue; // top bar spans by design
      if (r.right > vw + 1) {
        bad.push(
          `${el.tagName.toLowerCase()}.${el.className?.toString().split(' ')[0] ?? ''} right=${Math.round(r.right)}`
        );
      }
    }
    return bad.slice(0, 5);
  });

  expect(offenders, `elements exceed viewport: ${offenders.join(', ')}`).toHaveLength(0);
});

test('mobile sidebar opens, navigates, and closes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  // Open the drawer
  const menuButton = page.locator('button[aria-label*="navigation menu"]');
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const sidebar = page.locator('#sidebar-nav');
  await expect(sidebar).toBeVisible();

  // Navigate via drawer
  await page.locator('#sidebar-nav a[href="/dashboard/live"]').click();
  await expect(page).toHaveURL(/\/dashboard\/live/);

  // Drawer auto-closed after route change
  await expect(sidebar).not.toBeVisible();
});

test('security headers are present (SaaS guardrails)', async ({ request }) => {
  const res = await request.get('/api/runs');
  const h = res.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['cache-control']).toContain('no-store');
});

test('rate limiter responds with 429 and Retry-After', async ({ request }) => {
  // POST /api/scan is rate-limited at 30 req/min/IP and rejects malformed
  // bodies with 400 (validation) without consuming engine work. Send 31+
  // requests — the last ones must trip the limiter (429 + Retry-After).
  let last;
  for (let i = 0; i < 34; i++) {
    last = await request.post('/api/scan', {
      data: { invalid: true },
      headers: { 'Content-Type': 'application/json' },
    });
  }
  expect(last?.status()).toBe(429);
  expect(Number(last?.headers()['retry-after'] ?? 0)).toBeGreaterThan(0);
});

test('installer widget: OS tabs switch commands dynamically', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/download', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  // Default (Linux): curl one-liner visible
  const cmdPanel = page.locator('[data-testid="install-command"]');
  await expect(cmdPanel).toContainText('curl -sSL');
  await expect(cmdPanel).toContainText('linux.sh | bash');

  // Switch to macOS — mac.sh script
  await page.locator('button[role="tab"]:has-text("macOS")').click();
  await expect(cmdPanel).toContainText('mac.sh | bash');

  // Switch to Windows — PowerShell WebClient one-liner
  await page.locator('button[role="tab"]:has-text("Windows")').click();
  await expect(cmdPanel).toContainText("iex ((New-Object System.Net.WebClient).DownloadString('");
  await expect(cmdPanel).toContainText('windows.ps1');

  // Switch method to npm — identical command on every OS
  await page.locator('button[role="tab"]:has-text("npm")').click();
  await expect(cmdPanel).toContainText('npm install -g cyberpulse-auditor');

  // Switch back to Linux via tab — npm stays, command unchanged, tab active
  await page.locator('#install-tab-linux').click();
  await expect(cmdPanel).toContainText('npm install -g cyberpulse-auditor');
});

test('installer widget: stays in sync with the onboarding page switcher', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  const cmdPanel = page.locator('[data-testid="install-command"]');

  // Click the PAGE's Windows platform button — widget must follow.
  await page.locator('button:has-text("Windows")').first().click();
  await expect(cmdPanel).toContainText('windows.ps1');

  // Now click the WIDGET's macOS tab — the page buttons must follow back.
  await page.locator('#install-tab-macos').click();
  await expect(cmdPanel).toContainText('mac.sh | bash');
  // The page's macOS button is rendered active (aria-pressed).
  await expect(
    page.locator('button[aria-pressed="true"]:has-text("macOS")').first()
  ).toBeVisible();
});

test('installer widget: copy button flips to Copied state', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/download', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  const copyBtn = page.locator('button[aria-label*="Copy Linux install command"]');
  await expect(copyBtn).toBeVisible();

  // Grant clipboard permissions and copy
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await copyBtn.click();
  await expect(page.locator('text=Copied!')).toBeVisible({ timeout: 5000 });
});
