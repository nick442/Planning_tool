// Renders the app icons (PNG) from inline SVG with Playwright's Chromium.
// Run: pnpm --filter @planning/web icons
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const out = fileURLToPath(new URL('../public/icons/', import.meta.url));

/** The tick mark on a rounded indigo square; `inset` shrinks it for maskable icons. */
const svg = ({ size, radius, inset }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="#6366f1"/>
  <g transform="translate(16 16) scale(${1 - inset}) translate(-16 -16)">
    <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const icons = [
  { file: 'icon-192.png', size: 192, radius: 7, inset: 0 },
  { file: 'icon-512.png', size: 512, radius: 7, inset: 0 },
  // Maskable: full-bleed background, artwork inside the 80% safe zone.
  { file: 'maskable-512.png', size: 512, radius: 0, inset: 0.3 },
  // iOS draws its own rounded corners.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, inset: 0.15 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(icon)}</body></html>`,
  );
  await page.locator('svg').screenshot({ path: out + icon.file, omitBackground: true });
}
await browser.close();
console.log('Icons written to', out);
