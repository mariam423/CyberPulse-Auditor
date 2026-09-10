import { test, expect } from '@playwright/test';

/**
 * CyberPulse Auditor — API-level End-to-End tests
 *
 * Full backend stack coverage: Next.js production server → API routes →
 * core audit engine → shared SQLite → SARIF formatter. No browser required,
 * runs in any CI sandbox.
 */

test.describe('API surface — run history', () => {
  test('GET /api/runs returns the run history as JSON', async ({ request }) => {
    const res = await request.get('/api/runs');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('application/json');

    const body = (await res.json()) as { runs: Array<{ runId: string; status: string; findingsCount: number }> };
    expect(Array.isArray(body.runs)).toBe(true);
    for (const run of body.runs) {
      expect(run.runId).toMatch(/^run_/);
    }
  });

  test('GET /api/runs/<unknown-id> responds 404', async ({ request }) => {
    const res = await request.get('/api/runs/run_does_not_exist');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toContain('not found');
  });

  test('GET /api/runs/<unknown-id>/sarif responds 404', async ({ request }) => {
    const res = await request.get('/api/runs/run_does_not_exist/sarif');
    expect(res.status()).toBe(404);
  });
});

test.describe('API surface — scan engine', () => {
  test('POST /api/scan rejects malformed bodies', async ({ request }) => {
    const res = await request.post('/api/scan', {
      data: { not: 'a valid StartScanRequest' },
    });
    expect([400, 422, 500]).toContain(res.status());
  });

  test('POST /api/scan runs a full closed-loop audit and persists it', async ({ request }) => {
    const res = await request.post('/api/scan', {
      data: {
        goal: 'e2e ssrf + deser coverage probe',
        target: { type: 'http', url: 'http://127.0.0.1:19999' },
        model: { provider: 'openai', model: 'gpt-4o' },
        owaspIds: ['LLM05', 'LLM06'], // SSRF + deserialization categories
        maxIterations: 1,
        applyPatches: false,
        allowOpenCritical: true,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      runId: string;
      status: string;
      findingsCount: number;
      iterations: number;
    };

    expect(body.runId).toMatch(/^run_/);
    expect(['complete', 'partial']).toContain(body.status);
    expect(body.iterations).toBe(1);

    // The new run must be immediately visible in the run history (shared DB parity)
    const listed = await request.get('/api/runs');
    const history = (await listed.json()) as { runs: Array<{ runId: string }> };
    expect(history.runs.some((r) => r.runId === body.runId)).toBe(true);

    // And its detail route must resolve
    const detail = await request.get(`/api/runs/${body.runId}`);
    expect(detail.ok()).toBeTruthy();
    const detailBody = (await detail.json()) as { runId: string; findings: unknown[] };
    expect(detailBody.runId).toBe(body.runId);
    expect(Array.isArray(detailBody.findings)).toBe(true);
  });
});

test.describe('API surface — SARIF 2.1.0 compliance', () => {
  test('downloaded SARIF is valid 2.1.0 with tool, results, and headers', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string; findingsCount: number }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to inspect');

    const sarifRes = await request.get(`/api/runs/${runId}/sarif`);
    expect(sarifRes.ok()).toBeTruthy();
    expect(sarifRes.headers()['content-type']).toContain('sarif');
    expect(sarifRes.headers()['content-disposition'] ?? '').toContain(`cyberpulse-${runId}.sarif`);

    const sarif = (await sarifRes.json()) as {
      version: string;
      $schema: string;
      runs: Array<{ tool: { driver: { name: string; version: string } }; results: unknown[] }>;
    };

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-schema-2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]?.tool.driver.name).toBe('CyberPulse Auditor');
    expect(sarif.runs[0]?.tool.driver.version).toBe('0.1.0');
    expect(Array.isArray(sarif.runs[0]?.results)).toBe(true);
  });

  test('SARIF results count matches the run findings count', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string; findingsCount: number }> };
    const run = history.runs[0];
    test.skip(!run, 'no runs in the database to inspect');

    const sarifRes = await request.get(`/api/runs/${run.runId}/sarif`);
    const sarif = (await sarifRes.json()) as { runs: Array<{ results: unknown[] }> };
    expect(sarif.runs[0]?.results.length).toBe(run.findingsCount);
  });
});
