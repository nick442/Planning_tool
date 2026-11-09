import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  // The shared package ships TypeScript source, so bundle it into the server.
  noExternal: ['@planning/shared'],
  // Native module: loaded from node_modules at runtime.
  external: ['better-sqlite3'],
});
