import { describe, expect, it } from 'vitest';
import { buildTree, keysBetween, type Step } from '@planning/shared';
import { flattenVisible, getProjection, visibleSibling, withoutDescendants } from './outlineModel';

const T = '2026-11-08T09:00:00.000Z';

/** Indented outline → steps (id = title, two spaces per level). */
function outline(text: string): Step[] {
  const lines = text.split('\n').filter((l) => l.trim());
  const base = Math.min(...lines.map((l) => l.length - l.trimStart().length));
  const stack: { id: string; depth: number }[] = [];
  const counts = new Map<string | null, number>();
  const parsed = lines.map((line) => {
    const depth = (line.length - line.trimStart().length - base) / 2;
    while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();
    const parentId = stack.at(-1)?.id ?? null;
    const id = line.trim();
    stack.push({ id, depth });
    counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
    return { id, parentId };
  });
  const keys = new Map([...counts].map(([p, n]) => [p, keysBetween(null, null, n)]));
  return parsed.map(({ id, parentId }) => ({
    id,
    goalId: 'g',
    parentId,
    order: keys.get(parentId)!.shift()!,
    title: id,
    status: 'open',
    createdAt: T,
    updatedAt: T,
    deleted: false,
  }));
}

const steps = outline(`
  A
    A1
    A2
      A2a
  B
  C
`);
const rows = (collapsed: Record<string, true> = {}) =>
  flattenVisible(buildTree(steps, 'g'), collapsed);
const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe('flattenVisible', () => {
  it('lists rows in display order with depth', () => {
    expect(rows().map((r) => `${r.depth}:${r.id}`)).toEqual([
      '0:A',
      '1:A1',
      '1:A2',
      '2:A2a',
      '0:B',
      '0:C',
    ]);
  });

  it('skips the children of collapsed steps', () => {
    const list = rows({ A: true });
    expect(ids(list)).toEqual(['A', 'B', 'C']);
    expect(list[0]).toMatchObject({ collapsed: true, hasChildren: true });
  });

  it('ignores collapse state on leaves', () => {
    expect(rows({ B: true }).find((r) => r.id === 'B')?.collapsed).toBe(false);
  });
});

describe('withoutDescendants / visibleSibling', () => {
  it('removes a branch below the dragged row', () => {
    expect(ids(withoutDescendants(rows(), 'A'))).toEqual(['A', 'B', 'C']);
    expect(ids(withoutDescendants(rows(), 'A2'))).toEqual(['A', 'A1', 'A2', 'B', 'C']);
  });

  it('finds the visible sibling above and below', () => {
    expect(visibleSibling(rows(), 'B', 'up')?.id).toBe('A');
    expect(visibleSibling(rows(), 'A', 'down')?.id).toBe('B');
    expect(visibleSibling(rows(), 'A2', 'up')?.id).toBe('A1');
    expect(visibleSibling(rows(), 'A1', 'up')).toBeUndefined();
    expect(visibleSibling(rows(), 'A2', 'down')).toBeUndefined();
  });
});

describe('getProjection', () => {
  const W = 20;

  it('reorders among siblings when dragged straight up', () => {
    const list = withoutDescendants(rows(), 'C');
    expect(getProjection(list, 'C', 'B', 0, W)).toEqual({
      depth: 0,
      parentId: null,
      position: { afterId: 'A' },
    });
  });

  it('dropping into the first slot goes to the start', () => {
    const list = withoutDescendants(rows(), 'B');
    expect(getProjection(list, 'B', 'A', 0, W)).toEqual({
      depth: 0,
      parentId: null,
      position: { afterId: null },
    });
  });

  it('dragging right nests under the row above', () => {
    const list = withoutDescendants(rows(), 'C');
    // C stays in place but moves one level right → last child of B.
    expect(getProjection(list, 'C', 'C', W, W)).toEqual({
      depth: 1,
      parentId: 'B',
      position: { afterId: null },
    });
  });

  it('clamps the depth to one level below the row above', () => {
    const list = withoutDescendants(rows(), 'C');
    expect(getProjection(list, 'C', 'C', W * 5, W)?.depth).toBe(1);
  });

  it('dragging left out of a nested list outdents', () => {
    const list = withoutDescendants(rows(), 'A2a');
    expect(getProjection(list, 'A2a', 'A2a', -W, W)).toEqual({
      depth: 1,
      parentId: 'A',
      position: { afterId: 'A2' },
    });
  });

  it('cannot go shallower than the row below allows', () => {
    // Dropping A1's slot between A and A2: A2 is at depth 1 so A1 must stay ≥ 1.
    const list = withoutDescendants(rows(), 'A1');
    expect(getProjection(list, 'A1', 'A1', -W * 3, W)?.depth).toBe(1);
  });

  it('dropping onto a collapsed step appends to its hidden children', () => {
    const list = withoutDescendants(rows({ A: true }), 'B');
    expect(getProjection(list, 'B', 'B', W, W)).toEqual({
      depth: 1,
      parentId: 'A',
      position: undefined,
    });
  });

  it('returns null for unknown ids', () => {
    expect(getProjection(rows(), 'nope', 'A', 0, W)).toBeNull();
  });
});
