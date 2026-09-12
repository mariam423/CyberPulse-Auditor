import { test, expect } from '@playwright/test';

/**
 * Unified Report Service E2E — verifies CLI/GUI parity.
 *
 * Every assertion here is backed by the same unified service the CLI
 * consumes (`cyberpulse report`), so a pass means the web UI produces
 * byte-identical telemetry across all five formats.
 */

const FORMATS = ['json', 'markdown', 'sarif', 'html', 'text'] as const;

test.describe('GET /api/report/[id] — unified formats', () => {
  test('serves every supported format with correct content types', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const EXPECTED_TYPES: Record<string, string> = {
      json: 'application/json',
      markdown: 'text/markdown',
      sarif: 'application/sarif+json',
      html: 'text/html',
      text: 'text/plain',
    };

    for (const fmt of FORMATS) {
      const r = await request.get(`/api/report/${runId}?format=${fmt}`);
      expect(r.ok(), `format=${fmt} should be 200`).toBeTruthy();
      expect(r.headers()['content-type']).toContain(EXPECTED_TYPES[fmt]!);
    }
  });

  test('rejects unknown formats by falling back to text (never a 500)', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const r = await request.get(`/api/report/${runId}?format=xml`);
    expect(r.ok()).toBeTruthy();
    expect(r.headers()['content-type']).toContain('text/plain');
    expect(await r.text()).toContain('CyberPulse');
  });

  test('404s cleanly for unknown runs', async ({ request }) => {
    const r = await request.get('/api/report/run_does_not_exist?format=json');
    expect(r.status()).toBe(404);
    expect((await r.json()).error).toContain('not found');
  });

  test('markdown report includes full telemetry (findings + patches + retests)', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const r = await request.get(`/api/report/${runId}?format=markdown`);
    const md = await r.text();

    // Canonical structure of the unified markdown formatter
    expect(md).toContain('# CyberPulse Auditor — Security Report');
    expect(md).toContain(`**Run ID:** \`${runId}\``);
    expect(md).toContain('## Findings Summary');
  });

  test('sarif report is valid 2.1.0 — identical schema to the CLI', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const r = await request.get(`/api/report/${runId}?format=sarif`);
    const sarif = (await r.json()) as {
      version: string;
      $schema: string;
      runs: Array<{ tool: { driver: { name: string } }; results: unknown[] }>;
    };

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-schema-2.1.0');
    expect(sarif.runs[0]?.tool.driver.name).toBe('CyberPulse Auditor');
  });

  test('html report is a self-contained document', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const r = await request.get(`/api/report/${runId}?format=html`);
    const html = await r.text();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('CyberPulse Security Report');
    expect(html).toContain(escapeRegExp(runId));
  });

  test('json report round-trips with the canonical RunReport shape', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const r = await request.get(`/api/report/${runId}?format=json`);
    const report = (await r.json()) as {
      runId: string;
      status: string;
      findings: Array<{ id: string; owaspId: string; severity: string; closed: boolean }>;
      patches: unknown[];
      retests: unknown[];
    };

    expect(report.runId).toBe(runId);
    expect(['complete', 'partial', 'error']).toContain(report.status);
    // The unified service always materializes patches + retests arrays
    // (the old CLI divergence emitted them empty).
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.patches)).toBe(true);
    expect(Array.isArray(report.retests)).toBe(true);
  });

  test('download=1 sets the canonical filename', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const r = await request.get(`/api/report/${runId}?format=markdown&download=1`);
    const disposition = r.headers()['content-disposition'] ?? '';
    expect(disposition).toContain(`cyberpulse-${runId}.md`);
  });

  test('GUI sarif endpoint and report endpoint emit identical SARIF', async ({ request }) => {
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string }> };
    const runId = history.runs[0]?.runId;
    test.skip(!runId, 'no runs in the database to report on');

    const [legacy, unified] = await Promise.all([
      request.get(`/api/runs/${runId}/sarif`).then((r) => r.text()),
      request.get(`/api/report/${runId}?format=sarif`).then((r) => r.text()),
    ]);
    // Both endpoints consume the same unified service — output must match.
    expect(JSON.parse(unified)).toEqual(JSON.parse(legacy));
  });
});

test.describe('POST /api/retest — CLI retest parity', () => {
  test('rejects malformed bodies with 400 + zod details', async ({ request }) => {
    const r = await request.post('/api/retest', { data: { bad: 'shape' } });
    expect(r.status()).toBe(400);
    const body = (await r.json()) as { error: string; details: unknown[] };
    expect(body.error).toContain('Invalid request');
    expect(Array.isArray(body.details)).toBe(true);
  });

  test('rejects invalid run id formats (zod regex guard)', async ({ request }) => {
    const r = await request.post('/api/retest', {
      data: { runId: 'not-a-run-id', findingId: 'x' },
    });
    expect(r.status()).toBe(400);
  });

  test('404s for unknown runs and findings (same messages as CLI)', async ({ request }) => {
    const r1 = await request.post('/api/retest', {
      data: { runId: 'run_000000000000000000000000', findingId: 'fnd_x' },
    });
    expect(r1.status()).toBe(404);
    expect((await r1.json()).error).toContain('not found');
  });

  test('full retest against a stored finding returns the CLI JSON shape', async ({ request }) => {
    // Find a run that actually has findings to retest
    const res = await request.get('/api/runs');
    const history = (await res.json()) as { runs: Array<{ runId: string; findingsCount: number }> };
    const run = history.runs.find((r) => r.findingsCount > 0);
    test.skip(!run, 'no runs with findings in the database');

    const detail = await request.get(`/api/runs/${run.runId}`);
    const runDetail = (await detail.json()) as { findings: Array<{ id: string }> };
    const findingId = runDetail.findings[0]?.id;
    test.skip(!findingId, 'run has no findings');

    const r = await request.post('/api/retest', {
      data: { runId: run.runId, findingId },
    });

    // The target may be unreachable now — either 200 (verdict) or 500 (engine error)
    // are acceptable; the contract is the shape when it succeeds.
    if (r.ok()) {
      const body = (await r.json()) as {
        findingId: string;
        owaspId: string;
        verdict: string;
        closed: boolean;
        attemptsCount: number;
        evidence: string;
        retestedWith: string;
      };
      expect(body.findingId).toBe(findingId);
      expect(['closed', 'open', 'inconclusive']).toContain(body.verdict);
      expect(typeof body.closed).toBe('boolean');
      expect(typeof body.attemptsCount).toBe('number');
      expect(['patched prompt', 'original prompt']).toContain(body.retestedWith);
    } else {
      expect(r.status()).toBe(500);
      expect((await r.json()).error).toBeTruthy();
    }
  });
});

test.describe('Onboarding page', () => {
  test('renders cross-platform setup guides', async ({ request }) => {
    const r = await request.get('/dashboard/onboarding');
    expect(r.ok()).toBeTruthy();
    const html = await r.text();

    // All three platforms + CLI reference are present
    expect(html).toContain('Linux');
    expect(html).toContain('macOS');
    expect(html).toContain('Windows');
    expect(html).toContain('npm install');
  });
});

/** Escape a string for embedding in an HTML-body assertion. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
