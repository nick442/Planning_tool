import { expect, test } from '@playwright/test';
import { createGoal, drag, outlineText } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('breaks a goal down with the keyboard and keeps it after a reload', async ({ page }) => {
  await createGoal(page, 'Thesis', '2099-03-31');
  await page.getByRole('button', { name: 'Add step' }).click();

  const kb = page.keyboard;
  await kb.type('Literature review');
  await kb.press('Enter');
  await kb.press('Tab');
  await kb.type('Find sources');
  await kb.press('Enter');
  await kb.press('Tab');
  await kb.type('Search Scopus');
  await kb.press('Enter');
  await kb.type('Ask supervisor');
  await kb.press('Enter');
  await kb.press('Shift+Tab');
  await kb.press('Shift+Tab');
  await kb.type('Methodology');
  await kb.press('Escape');

  const expected = [
    'Literature review',
    '  Find sources',
    '    Search Scopus',
    '    Ask supervisor',
    'Methodology',
  ].join('\n');
  await expect.poll(() => outlineText(page)).toBe(expected);

  // Complete a leaf with Space from navigation mode.
  await page.getByRole('treeitem', { name: 'Search Scopus' }).focus();
  await kb.press(' ');
  await expect(page.getByRole('treeitem', { name: 'Search Scopus' })).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'Thesis progress' })).toHaveAttribute(
    'aria-valuenow',
    '33',
  );

  await page.reload();
  await expect.poll(() => outlineText(page)).toBe(expected.replace('    Search Scopus\n', ''));
  await expect(page.getByText(/days left/)).toBeVisible();
});

test('reorders goals by drag and drop', async ({ page }) => {
  await createGoal(page, 'First');
  await createGoal(page, 'Second');
  await createGoal(page, 'Third');
  const list = page.getByRole('list', { name: 'Goal list' });
  const names = () => list.locator('li').evaluateAll((els) => els.map((e) => e.textContent));

  await list.locator('li').nth(2).hover();
  const handle = await page.getByRole('button', { name: 'Reorder Third' }).boundingBox();
  const target = await list.locator('li').nth(0).boundingBox();
  await drag(
    page,
    { x: handle!.x + handle!.width / 2, y: handle!.y + handle!.height / 2 },
    { x: handle!.x + handle!.width / 2, y: target!.y + 4 },
  );

  await expect
    .poll(names)
    .toEqual([
      expect.stringContaining('Third'),
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
    ]);
  await page.reload();
  await expect
    .poll(names)
    .toEqual([
      expect.stringContaining('Third'),
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
    ]);
});

test('drags a step into another branch', async ({ page }) => {
  await createGoal(page, 'Exam');
  await page.getByRole('button', { name: 'Add step' }).click();
  const kb = page.keyboard;
  await kb.type('Revise');
  await kb.press('Enter');
  await kb.press('Tab');
  await kb.type('Chapter 1');
  await kb.press('Enter');
  await kb.press('Shift+Tab');
  await kb.type('Practice exam');
  await kb.press('Escape');
  await expect.poll(() => outlineText(page)).toBe('Revise\n  Chapter 1\nPractice exam');

  // Drag "Practice exam" one level (20px) to the right: it becomes Revise's last child.
  const row = page.getByRole('treeitem', { name: 'Practice exam' });
  await row.hover();
  const grip = await row.getByRole('button', { name: 'Drag to move' }).boundingBox();
  const start = { x: grip!.x + grip!.width / 2, y: grip!.y + grip!.height / 2 };
  await drag(page, start, { x: start.x + 24, y: start.y });

  await expect.poll(() => outlineText(page)).toBe('Revise\n  Chapter 1\n  Practice exam');
});
