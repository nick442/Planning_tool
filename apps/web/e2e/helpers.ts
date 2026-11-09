import { expect, type Page } from '@playwright/test';

export async function createGoal(page: Page, title: string, deadline?: string) {
  await page.getByRole('button', { name: 'New goal' }).click();
  await page.getByLabel('Title').fill(title);
  if (deadline) await page.getByLabel('Deadline').fill(deadline);
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

/** The outline as indented text, e.g. "A\n  A1". */
export async function outlineText(page: Page): Promise<string> {
  return page.$$eval('[role=treeitem]', (els) =>
    els
      .map(
        (e) =>
          `${'  '.repeat(Number(e.getAttribute('aria-level')) - 1)}${e.getAttribute('aria-label')}`,
      )
      .join('\n'),
  );
}

/** Drags from one element's centre to a point, in small steps so dnd-kit picks it up. */
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 8, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();
}
