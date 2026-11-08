import { defineConfig, devices } from '@playwright/test';

const previewPort = 4173;
const syncPort = 4174;
const syncDb = 'e2e/.data/sync-e2e.db';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${previewPort}`,
    trace: 'off',
    // The offline test needs the service worker.
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/mobile\.spec\.ts/, /sync\.spec\.ts/],
    },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
    {
      // Two devices against the real server (Hono + SQLite) serving the built app.
      name: 'sync',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${syncPort}` },
      testMatch: /sync\.spec\.ts/,
    },
  ],
  // Started in order: the first builds the web app and the server.
  webServer: [
    {
      command: [
        'pnpm exec vite build',
        'pnpm --filter @planning/server build',
        `rm -rf e2e/.data && mkdir -p e2e/.data`,
        `PORT=${syncPort} PLANNING_DB=${syncDb} WEB_ROOT=dist node ../server/dist/index.js`,
      ].join(' && '),
      port: syncPort,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // Always serve the current build; a stale server would test old code.
      command: `pnpm exec vite preview --port ${previewPort} --strictPort`,
      port: previewPort,
      // These tests run without a sync server; its proxy errors are expected noise.
      stderr: 'ignore',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
