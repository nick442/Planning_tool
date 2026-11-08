import { keysBetween } from '../src/order';
import type { Step } from '../src/schema';
import { buildTree, type TreeNode } from '../src/tree';

export const T0 = '2026-11-01T09:00:00.000Z';
export const T1 = '2026-11-02T10:00:00.000Z';
export const T2 = '2026-11-03T11:00:00.000Z';

/** Deterministic id generator: new-1, new-2, ... */
export function idGen(prefix = 'new'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export function makeStep(overrides: Partial<Step> & Pick<Step, 'id'>): Step {
  return {
    goalId: 'g1',
    parentId: null,
    order: 'a0',
    title: overrides.id,
    status: 'open',
    createdAt: T0,
    updatedAt: T0,
    deleted: false,
    ...overrides,
  };
}

/**
 * Builds steps from an indented outline. Each line is a step whose id and
 * title are the line text; two spaces per level. A trailing `[x]` marks it
 * done (completed at T0), `[x auto]` marks it auto-completed.
 *
 *   outline('g1', `
 *     A
 *       A1 [x]
 *       A2
 *     B
 *   `)
 */
export function outline(goalId: string, text: string): Step[] {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const baseIndent = Math.min(...lines.map((l) => l.length - l.trimStart().length));
  const steps: Step[] = [];
  const stack: { id: string; depth: number }[] = [];
  const childCount = new Map<string, number>();
  const raw: { id: string; parentId: string | null; done: boolean; auto: boolean }[] = [];

  for (const line of lines) {
    const depth = (line.length - line.trimStart().length - baseIndent) / 2;
    let title = line.trim();
    const auto = title.endsWith('[x auto]');
    const done = auto || title.endsWith('[x]');
    title = title.replace(/\s*\[x( auto)?\]$/, '');
    while (stack.length > 0 && stack.at(-1)!.depth >= depth) stack.pop();
    const parentId = stack.at(-1)?.id ?? null;
    raw.push({ id: title, parentId, done, auto });
    const key = parentId ?? 'root';
    childCount.set(key, (childCount.get(key) ?? 0) + 1);
    stack.push({ id: title, depth });
  }

  const keys = new Map<string, string[]>();
  for (const [key, n] of childCount) keys.set(key, keysBetween(null, null, n));

  for (const r of raw) {
    const order = keys.get(r.parentId ?? 'root')!.shift()!;
    steps.push(
      makeStep({
        id: r.id,
        goalId,
        parentId: r.parentId,
        order,
        ...(r.done ? { status: 'done', completedAt: T0 } : {}),
        ...(r.auto ? { autoCompleted: true } : {}),
      }),
    );
  }
  return steps;
}

/** Renders a goal's tree back into the outline format (completed included). */
export function render(steps: readonly Step[], goalId: string): string {
  const lines: string[] = [];
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      const mark =
        node.step.status === 'done' ? (node.step.autoCompleted ? ' [x auto]' : ' [x]') : '';
      lines.push(`${'  '.repeat(node.depth)}${node.step.title}${mark}`);
      visit(node.children);
    }
  };
  visit(buildTree(steps, goalId, { includeCompleted: true }));
  return lines.join('\n');
}

/** Normalises an outline literal for comparison with {@link render}. */
export function dedent(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const base = Math.min(...lines.map((l) => l.length - l.trimStart().length));
  return lines.map((l) => l.slice(base).trimEnd()).join('\n');
}

export function byId(steps: readonly Step[], id: string): Step {
  const step = steps.find((s) => s.id === id);
  if (!step) throw new Error(`no step ${id}`);
  return step;
}

/** Deep-freezes the input so tests catch accidental mutation. */
export function frozen<T>(items: T[]): readonly T[] {
  for (const item of items) Object.freeze(item);
  return Object.freeze(items);
}
