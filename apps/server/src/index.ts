import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '127.0.0.1';

serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  console.log(`Planning server listening on http://${info.address}:${info.port}`);
});
