import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { outlineText } from './helpers';

// Both tests share the one server, so they run one after the other with their own goals.
test.describe.configure({ mode: 'serial' });

async function openDevices(browser: Browser) {
  const laptop = await (await browser.newContext()).newPage();
  const phoneContext = await browser.newContext({ ...devices['Pixel 7'] });
  const phone = await phoneContext.newPage();
  await laptop.goto('/');
  await phone.goto('/');
  return { laptop, phone, phoneContext };
}

const syncStatus = (page: Page) => page.getByRole('button', { name: /^Sync:/ }).first();

async function createGoalWithSteps(page: Page, title: string, steps: string[]) {
  await page.getByRole('button', { name: 'New goal' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Create goal' }).click();
  await page.getByRole('button', { name: 'Add step' }).click();
  for (const step of steps) {
    await page.keyboard.type(step);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await expect(syncStatus(page)).toHaveAccessibleName('Sync: Synced', { timeout: 10_000 });
}

async function openGoalOnPhone(phone: Page, title: string) {
  const goal = phone.getByRole('button', { name: new RegExp(`^${title}`) });
  await expect(goal).toBeVisible({ timeout: 10_000 });
  await goal.tap();
  await expect(phone.getByRole('heading', { name: title })).toBeVisible();
}

test('a step completed on the phone shows up on the laptop within seconds', async ({ browser }) => {
  const { laptop, phone } = await openDevices(browser);
  const title = `Thesis ${Date.now()}`;
  await createGoalWithSteps(laptop, title, ['Read paper X', 'Outline chapter 2']);

  // The phone gets the goal and its steps.
  await openGoalOnPhone(phone, title);
  await expect.poll(() => outlineText(phone)).toBe('Read paper X\nOutline chapter 2');

  // Complete on the phone…
  await phone.getByRole('treeitem', { name: 'Read paper X' }).getByRole('checkbox').tap();

  // …and the laptop shows it, without a reload, within a few seconds.
  await expect.poll(() => outlineText(laptop), { timeout: 5_000 }).toBe('Outline chapter 2');
  await expect(
    laptop
      .getByRole('region', { name: 'Completed' })
      .getByRole('button', { name: `Read paper X ${title}` }),
  ).toBeVisible();

  // And the other way round: a rename on the laptop reaches the phone.
  await laptop.getByText('Outline chapter 2').click();
  await laptop.keyboard.press('End');
  await laptop.keyboard.type(' (draft)');
  await laptop.keyboard.press('Escape');
  await expect.poll(() => outlineText(phone), { timeout: 5_000 }).toBe('Outline chapter 2 (draft)');
});

test('changes made offline sync once the device is back online', async ({ browser }) => {
  const { laptop, phone, phoneContext } = await openDevices(browser);
  const title = `Exam ${Date.now()}`;
  await createGoalWithSteps(laptop, title, ['Formula sheet', 'Past paper']);
  await openGoalOnPhone(phone, title);
  await expect.poll(() => outlineText(phone)).toBe('Formula sheet\nPast paper');

  await phoneContext.setOffline(true);
  await phone.getByRole('treeitem', { name: 'Past paper' }).getByRole('checkbox').tap();
  await expect.poll(() => outlineText(phone)).toBe('Formula sheet');
  await expect(syncStatus(phone)).toHaveAccessibleName(/Offline/, { timeout: 5_000 });

  // The laptop can't know yet.
  await laptop.waitForTimeout(1500);
  expect(await outlineText(laptop)).toBe('Formula sheet\nPast paper');

  await phoneContext.setOffline(false);
  await expect.poll(() => outlineText(laptop), { timeout: 10_000 }).toBe('Formula sheet');
  await expect(syncStatus(phone)).toHaveAccessibleName('Sync: Synced', { timeout: 10_000 });
});
