import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { unlinkSync, existsSync, rmSync } from 'node:fs';
import { SqliteStore } from '../src/store/sqlite.js';
import { loadCatalog } from '../src/owasp/catalog.js';
import { newRunId } from '../src/util/ids.js';

const TEST_DB = resolve(process.cwd(), 'data/test/hello.db');

describe('Hello World Integration', () => {
  let store: SqliteStore;

  beforeEach(() => {
    try { rmSync(TEST_DB, { force: true }); } catch { /* ignore */ }
    try { rmSync(TEST_DB.replace('.sqlite', ''), { force: true, recursive: true }); } catch { /* ignore */ }
    store = new SqliteStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
  });

  it('can create a run, write findings, and query them back as JSON', () => {
    const runId = newRunId();
    const target = JSON.stringify({ type: 'http', url: 'http://localhost:9999' });

    store.createRun(runId, target, { goal: 'test security', maxIterations: 1 });

    // Simulate finding insertion
    const findingId = 'fnd_00000001';
    store.addFinding({
      id: findingId as any,
      runId,
      owaspId: 'LLM01',
      severity: 'high',
      title: 'Prompt Injection',
      evidence: 'User input was echoed back without sanitization',
      repro: { payload: 'test', target: 'localhost:9999', expected: 'sanitized' },
    });

    // Query back
    const run = store.getRun(runId);
    expect(run).toBeDefined();
    expect(run?.id).toBe(runId);
    expect(run?.status).toBe('running');

    const findings = store.getFindingsByRun(runId);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.owasp_id).toBe('LLM01');
    expect(findings[0]?.severity).toBe('high');

    store.finishRun(runId, 'complete');
    const finished = store.getRun(runId);
    expect(finished?.status).toBe('complete');
  });

  it('OWASP catalog loads correctly from seed', () => {
    const catalog = loadCatalog();
    expect(catalog.size).toBe(10);
    expect(catalog.has('LLM01')).toBe(true);
    expect(catalog.has('LLM06')).toBe(true);
    const entry = catalog.get('LLM01');
    expect(entry?.title).toBe('Prompt Injection');
    expect(entry?.severity).toBe('critical');
  });

  it('can list runs', () => {
    const runId1 = newRunId();
    const runId2 = newRunId();
    store.createRun(runId1, 'target1', {});
    store.createRun(runId2, 'target2', {});

    const runs = store.listRuns();
    expect(runs).toHaveLength(2);
  });

  it('can add and query patches', () => {
    const runId = newRunId();
    store.createRun(runId, 'target', {});

    const findingId = 'fnd_patch_test';
    store.addFinding({
      id: findingId as any,
      runId,
      owaspId: 'LLM06',
      severity: 'critical',
      title: 'Excessive Agency',
      evidence: 'Agent took unauthorized action',
      repro: { payload: 'do it', target: 'localhost', expected: 'denied' },
    });

    store.addPatch({
      id: 'pat_001' as any,
      runId,
      findingId: findingId as any,
      kind: 'prompt',
      before: 'You are a helpful agent',
      afterOrDiff: 'You are a helpful agent. Confirm before taking actions.',
      zodSchema: 'z.string().refine(val => !val.includes("do it"))',
      rationale: 'Added confirmation step before agency actions',
    });

    const patches = store.getPatchesByFinding(findingId as any);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.kind).toBe('prompt');
  });
});
