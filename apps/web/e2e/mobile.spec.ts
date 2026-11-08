import { expect, test, type Page } from '@playwright/test';
import { outlineText } from './helpers';

/** Real touch events through the DevTools protocol, so the page sees genuine pointer events. */
async function touchSwipe(page: Page, from: { x: number; y: number }, dx: number, dy = 0) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, x?: number, y?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type: type as 'touchStart' | 'touchMove' | 'touchEnd',
      touchPoints: x === undefined ? [] : [{ x, y: y! }],
    });
  await send('touchStart', from.x, from.y);
  for (let i = 1; i <= 10; i++) {
    await send('touchMove', from.x + (dx * i) / 10, from.y + (dy * i) / 10);
  }
  await send('touchEnd');
}

async function createGoal(page: Page, title: string) {
  await page.getByRole('button', { name: 'New goal' }).tap();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Create goal' }).tap();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

test('goal list, goal and Done are separate screens with bottom tabs', async ({ page }) => {
  await page.goto('/');
  await createGoal(page, 'Stats exam');
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  await expect(page.getByRole('navigation', { name: 'Goals' })).toBeHidden();

  // The floating button adds a step.
  await page.getByRole('button', { name: 'New step' }).tap();
  await page.keyboard.type('Formula sheet');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Past paper');
  await page.keyboard.press('Escape');
  await expect.poll(() => outlineText(page)).toBe('Formula sheet\nPast paper');

  await tabs.getByRole('button', { name: /Done/ }).tap();
  await expect(page.getByRole('main').getByText(/Finished steps collect here/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stats exam' })).toBeHidden();

  // Goals returns to the open goal; tapping it again goes back to the list.
  await tabs.getByRole('button', { name: 'Goals' }).tap();
  await expect(page.getByRole('heading', { name: 'Stats exam' })).toBeVisible();
  await tabs.getByRole('button', { name: 'Goals' }).tap();
  await expect(page.getByRole('navigation', { name: 'Goals' })).toBeVisible();
});

test('swiping a step to the right completes it', async ({ page }) => {
  await page.goto('/');
  await createGoal(page, 'Thesis');
  await page.getByRole('button', { name: 'New step' }).tap();
  await page.keyboard.type('Read paper X');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Outline chapter 2');
  await page.keyboard.press('Escape');

  const row = page.getByRole('treeitem', { name: 'Read paper X' });
  const box = (await row.boundingBox())!;
  const start = { x: box.x + 80, y: box.y + box.height / 2 };

  // A short swipe springs back.
  await touchSwipe(page, start, 40);
  await expect(row).toBeVisible();
  await expect(page.getByLabel('Step title')).toHaveCount(0);

  // A full swipe completes it.
  await touchSwipe(page, start, 150);
  await expect(page.getByRole('status', { name: 'Notifications' })).toContainText(
    'Done: Read paper X',
  );
  await expect.poll(() => outlineText(page)).toBe('Outline chapter 2');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: /Done/ })
    .tap();
  await expect(
    page.getByRole('region', { name: 'Completed' }).getByText('Read paper X'),
  ).toBeVisible();
});

test('opens and works with no connection once installed', async ({ page, context }) => {
  await page.goto('/');
  await createGoal(page, 'Offline goal');
  await page.getByRole('button', { name: 'New step' }).tap();
  await page.keyboard.type('Saved before going offline');
  await page.keyboard.press('Escape');

  // Wait for the service worker, then reload so it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline goal' })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'Saved before going offline' })).toBeVisible();

  // Editing offline works and survives another reload.
  await page.getByRole('button', { name: 'New step' }).tap();
  await page.keyboard.type('Written offline');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('treeitem', { name: 'Written offline' })).toBeVisible();
  await context.setOffline(false);
});
