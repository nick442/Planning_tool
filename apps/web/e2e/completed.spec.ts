import { expect, test } from '@playwright/test';
import { createGoal, outlineText } from './helpers';

test('completed steps move to the feed, survive a reload and can be undone', async ({ page }) => {
  await page.goto('/');
  await createGoal(page, 'Thesis');
  await page.getByRole('button', { name: 'Add step' }).click();
  const kb = page.keyboard;
  await kb.type('Find sources');
  await kb.press('Enter');
  await kb.press('Tab');
  await kb.type('Search Scopus');
  await kb.press('Enter');
  await kb.type('Ask supervisor');
  await kb.press('Escape');

  const feed = page.getByRole('region', { name: 'Completed' });
  const check = (name: string) =>
    page.getByRole('treeitem', { name, exact: true }).getByRole('checkbox');

  await check('Search Scopus').click();
  await expect(feed.getByText('Search Scopus')).toBeVisible();
  await expect(feed.getByText('Thesis › Find sources')).toBeVisible();

  // Finishing the last child finishes the branch.
  await check('Ask supervisor').click();
  await expect(page.getByRole('status', { name: 'Notifications' })).toContainText(
    'Branch finished: Find sources',
  );
  await expect.poll(() => outlineText(page)).toBe('');
  await expect(page.getByText('Everything here is done. 🎉')).toBeVisible();

  await page.reload();
  await expect(feed.getByRole('listitem')).toHaveCount(3);
  await expect(feed.getByText('3 today')).toBeVisible();

  // Undo the step that finished the branch: both come back.
  await feed.getByRole('listitem').filter({ hasText: 'Ask supervisor' }).hover();
  await feed.getByRole('button', { name: 'Undo "Ask supervisor"' }).click();
  await expect.poll(() => outlineText(page)).toBe('Find sources\n  Ask supervisor');
  await expect(feed.getByRole('listitem')).toHaveCount(1);
});
