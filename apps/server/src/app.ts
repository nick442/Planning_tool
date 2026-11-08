import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { timingSafeEqual } from 'node:crypto';
import { pushRequestSchema } from '@planning/shared';
import { DEFAULT_PULL_LIMIT, type SyncService } from './sync';

export interface AppOptions {
  sync: SyncService;
  /** When set, /api/sync/* requires `Authorization: Bearer <token>` (or `?token=` for SSE). */
  token?: string;
  /** Folder with the built web app (apps/web/dist). Omit to serve the API only. */
  webRoot?: string;
  /** How often SSE connections get a keep-alive comment. */
  keepAliveMs?: number;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function requireToken(token: string | undefined): MiddlewareHandler {
  return async (c, next) => {
    if (!token) return next();
    const header = c.req.header('authorization');
    const given = header?.startsWith('Bearer ') ? header.slice(7) : c.req.query('token');
    if (!given || !safeEqual(given, token)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return next();
  };
}

/**
 * The HTTP app. Kept separate from `index.ts` (which opens the database and
 * starts listening) so tests can call `app.request()` directly.
 */
export function createApp({ sync, token, webRoot, keepAliveMs = 25_000 }: AppOptions) {
  const app = new Hono();

  app.get('/api/health', (c) =>
    c.json({ ok: true, rev: sync.currentRev, time: new Date().toISOString() }),
  );

  app.use('/api/sync/*', requireToken(token));

  app.post('/api/sync/push', bodyLimit({ maxSize: 10 * 1024 * 1024 }), async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = pushRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues.slice(0, 20) }, 400);
    }
    return c.json(sync.push(parsed.data));
  });

  app.get('/api/sync/pull', (c) => {
    const since = Number(c.req.query('since') ?? '0');
    const limit = Number(c.req.query('limit') ?? DEFAULT_PULL_LIMIT);
    if (!Number.isInteger(since) || since < 0 || !Number.isInteger(limit) || limit < 1) {
      return c.json({ error: 'invalid since or limit' }, 400);
    }
    return c.json(sync.pull(since, Math.min(limit, 5000)));
  });

  // Live "something changed" notifications for the other open devices.
  app.get('/api/sync/events', (c) =>
    streamSSE(c, async (stream) => {
      let unsubscribe = () => {};
      const closed = new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
        unsubscribe = sync.subscribe((rev) => {
          void stream.writeSSE({ event: 'changed', data: JSON.stringify({ rev }) });
        });
      });
      await stream.writeSSE({ event: 'hello', data: JSON.stringify({ rev: sync.currentRev }) });
      const ping = setInterval(() => void stream.write(': ping\n\n'), keepAliveMs);
      await closed;
      clearInterval(ping);
      unsubscribe();
    }),
  );

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  if (webRoot && existsSync(join(webRoot, 'index.html'))) {
    const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8');

    // Hashed build files never change; everything else (index.html, sw.js, the
    // manifest) must be revalidated so a new deploy is picked up.
    app.use('*', async (c, next) => {
      c.header(
        'Cache-Control',
        c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
      await next();
    });
    app.use('*', serveStatic({ root: webRoot }));
    // Single-page app: any other GET is the app itself.
    app.get('*', (c) => c.html(indexHtml));
  }

  return app;
}
