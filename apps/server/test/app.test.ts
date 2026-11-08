import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('server app', () => {
  it('GET /api/health reports ok', async () => {
    const res = await createApp().request('/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; time: string };
    expect(body.ok).toBe(true);
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });

  it('unknown routes return 404', async () => {
    const res = await createApp().request('/api/nope');
    expect(res.status).toBe(404);
  });
});
