import { expect, test } from '@playwright/test';

test('on a phone the goal list and the goal are separate screens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New goal' }).click();
  await page.getByLabel('Title').fill('Stats exam');
  await page.getByRole('button', { name: 'Create goal' }).click();

  await expect(page.getByRole('heading', { name: 'Stats exam' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Goals' })).toBeHidden();

  await page.getByRole('button', { name: 'Goals' }).click();
  await expect(page.getByRole('navigation', { name: 'Goals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stats exam' })).toBeHidden();

  await page.getByRole('button', { name: /^Stats exam/ }).click();
  await page.getByRole('button', { name: 'Add step' }).tap();
  await page.keyboard.type('Formula sheet');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('treeitem', { name: 'Formula sheet' })).toBeVisible();
});
