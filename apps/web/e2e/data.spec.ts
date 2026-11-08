import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createGoal, outlineText } from './helpers';

test('exports to JSON and imports into a fresh device', async ({ page, browser }) => {
  await page.goto('/');
  await createGoal(page, 'Thesis');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.keyboard.type('Literature review');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Find sources');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Export / import' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON export' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^planning-export-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const json = JSON.parse(await readFile(file, 'utf8')) as { format: string; steps: unknown[] };
  expect(json.format).toBe('planning-tool-export');
  expect(json.steps).toHaveLength(2);

  // A brand-new device (empty storage) loads the file.
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto('/');
  await expect(fresh.getByText('Nothing planned yet.')).toBeVisible();
  await fresh.getByRole('button', { name: 'Export / import' }).click();
  await fresh.getByLabel('Export file to import').setInputFiles(file);
  await expect(fresh.getByRole('status').filter({ hasText: 'Imported' })).toHaveText(
    'Imported 3 new and 0 updated records.',
  );
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByRole('heading', { name: 'Thesis' })).toBeVisible();
  await expect.poll(() => outlineText(fresh)).toBe('Literature review\n  Find sources');

  // Importing the same file again changes nothing.
  await fresh.getByRole('button', { name: 'Export / import' }).click();
  await fresh.getByLabel('Export file to import').setInputFiles(file);
  await expect(fresh.getByRole('status').filter({ hasText: 'Nothing new' })).toBeVisible();
});

test('refuses a file that is not an export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Export / import' }).click();
  await page.getByLabel('Export file to import').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"todo": ["buy milk"]}'),
  });
  await expect(page.getByRole('alert')).toContainText("isn't a Planning Tool export");
});
