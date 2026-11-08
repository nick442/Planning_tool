import { Hono } from 'hono';

/**
 * The Hono app. Kept separate from `index.ts` (which starts the HTTP server)
 * so tests can call `app.request()` directly.
 *
 * Milestone 5 adds /api/sync/push, /api/sync/pull, SSE and SQLite; Milestone 6
 * serves the built web app from here.
 */
export function createApp() {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

  return app;
}
