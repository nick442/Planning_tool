import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { goal, memorySync, step } from './helpers';

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

describe('API', () => {
  it('GET /api/health reports ok and the current revision', async () => {
    const res = await createApp({ sync: memorySync().sync }).request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, rev: 0 });
  });

  it('push then pull round-trips records', async () => {
    const app = createApp({ sync: memorySync().sync });
    const push = await app.request(
      '/api/sync/push',
      json({ goals: [goal('g1')], steps: [step('s1')] }),
    );
    expect(await push.json()).toEqual({ accepted: ['g1', 's1'], rev: 2 });

    const pull = await app.request('/api/sync/pull?since=1');
    const body = (await pull.json()) as { steps: { id: string }[]; goals: unknown[]; rev: number };
    expect(body.goals).toEqual([]);
    expect(body.steps.map((s) => s.id)).toEqual(['s1']);
    expect(body.rev).toBe(2);
  });

  it('rejects malformed pushes and bad parameters', async () => {
    const app = createApp({ sync: memorySync().sync });
    expect((await app.request('/api/sync/push', json({ steps: [{ id: 'x' }] }))).status).toBe(400);
    expect((await app.request('/api/sync/push', { method: 'POST', body: 'not json' })).status).toBe(
      400,
    );
    expect((await app.request('/api/sync/pull?since=-1')).status).toBe(400);
    expect((await app.request('/api/sync/pull?since=abc')).status).toBe(400);
  });

  it('requires the token when one is configured', async () => {
    const app = createApp({ sync: memorySync().sync, token: 's3cret' });
    expect((await app.request('/api/sync/pull?since=0')).status).toBe(401);
    expect(
      (await app.request('/api/sync/pull?since=0', { headers: { authorization: 'Bearer nope' } }))
        .status,
    ).toBe(401);
    expect(
      (await app.request('/api/sync/pull?since=0', { headers: { authorization: 'Bearer s3cret' } }))
        .status,
    ).toBe(200);
    // EventSource can't send headers, so the token may come as a query parameter.
    expect((await app.request('/api/sync/pull?since=0&token=s3cret')).status).toBe(200);
    // Health stays open for monitoring.
    expect((await app.request('/api/health')).status).toBe(200);
  });

  it('streams a "changed" event to listeners when another device pushes', async () => {
    const { sync } = memorySync();
    const app = createApp({ sync });
    const controller = new AbortController();
    const res = await app.request('/api/sync/events', { signal: controller.signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const readUntil = async (needle: string) => {
      while (!text.includes(needle)) text += decoder.decode((await reader.read()).value);
    };

    await readUntil('event: hello');
    sync.push({ goals: [], steps: [step('s1')] });
    await readUntil('event: changed');
    expect(text).toContain('data: {"rev":1}');
    controller.abort();
    await reader.cancel();
  });

  it('answers unknown API paths with JSON 404', async () => {
    const res = await createApp({ sync: memorySync().sync }).request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  describe('serving the web app', () => {
    const webRoot = mkdtempSync(join(tmpdir(), 'planning-web-'));
    mkdirSync(join(webRoot, 'assets'));
    writeFileSync(join(webRoot, 'index.html'), '<!doctype html><title>Planning</title>');
    writeFileSync(join(webRoot, 'assets', 'index-abc.js'), 'console.log(1)');
    writeFileSync(join(webRoot, 'sw.js'), '// sw');
    afterAll(() => rmSync(webRoot, { recursive: true, force: true }));
    const app = createApp({ sync: memorySync().sync, webRoot });

    it('serves hashed assets as immutable and the service worker as no-cache', async () => {
      const asset = await app.request('/assets/index-abc.js');
      expect(asset.status).toBe(200);
      expect(asset.headers.get('cache-control')).toContain('immutable');
      const sw = await app.request('/sw.js');
      expect(sw.headers.get('cache-control')).toBe('no-cache');
    });

    it('falls back to index.html for app routes, but not for the API', async () => {
      const page = await app.request('/some/deep/link');
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('<title>Planning</title>');
      expect((await app.request('/api/unknown')).status).toBe(404);
    });
  });
});
