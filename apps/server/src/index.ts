import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { openDatabase } from './db/client';
import { SyncService } from './sync';

// src/index.ts and dist/index.js both sit one level below the package root.
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '127.0.0.1';
const dbPath = process.env.PLANNING_DB ?? `${packageRoot}data/planning.db`;
const token = process.env.PLANNING_TOKEN || undefined;
const webRoot = process.env.WEB_ROOT ?? `${packageRoot}../web/dist`;

const database = openDatabase(dbPath, `${packageRoot}drizzle`);
const sync = new SyncService(database.db);
const app = createApp({ sync, token, webRoot });

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Planning server on http://${info.address}:${info.port}`);
  console.log(`  database: ${dbPath} (rev ${sync.currentRev})`);
  console.log(
    `  web app:  ${existsSync(`${webRoot}/index.html`) ? webRoot : 'not built (API only)'}`,
  );
  console.log(
    `  token:    ${token ? 'required' : 'not set (open to anyone who can reach this port)'}`,
  );
});

function shutdown() {
  server.close();
  database.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
