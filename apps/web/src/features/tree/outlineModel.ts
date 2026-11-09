import type { Position, TreeNode } from '@planning/shared';

/** One visible row of the outline. */
export interface FlatRow {
  id: string;
  parentId: string | null;
  depth: number;
  node: TreeNode;
  /** Has visible children (so it can be collapsed). */
  hasChildren: boolean;
  collapsed: boolean;
}

/** Flattens the visible tree into rows, skipping the children of collapsed steps. */
export function flattenVisible(
  nodes: readonly TreeNode[],
  collapsed: Readonly<Record<string, true>>,
): FlatRow[] {
  const rows: FlatRow[] = [];
  const visit = (list: readonly TreeNode[]) => {
    for (const node of list) {
      const hasChildren = node.children.length > 0;
      const isCollapsed = hasChildren && collapsed[node.step.id] === true;
      rows.push({
        id: node.step.id,
        parentId: node.step.parentId,
        depth: node.depth,
        node,
        hasChildren,
        collapsed: isCollapsed,
      });
      if (hasChildren && !isCollapsed) visit(node.children);
    }
  };
  visit(nodes);
  return rows;
}

/** Rows with every descendant of `id` removed (used while dragging a branch). */
export function withoutDescendants(rows: readonly FlatRow[], id: string): FlatRow[] {
  const out: FlatRow[] = [];
  let skipDepth: number | null = null;
  for (const row of rows) {
    if (skipDepth !== null) {
      if (row.depth > skipDepth) continue;
      skipDepth = null;
    }
    out.push(row);
    if (row.id === id) skipDepth = row.depth;
  }
  return out;
}

/** The visible sibling directly above / below a row, if any. */
export function visibleSibling(
  rows: readonly FlatRow[],
  id: string,
  direction: 'up' | 'down',
): FlatRow | undefined {
  const index = rows.findIndex((r) => r.id === id);
  const row = rows[index];
  if (!row) return undefined;
  const step = direction === 'up' ? -1 : 1;
  for (let i = index + step; i >= 0 && i < rows.length; i += step) {
    const candidate = rows[i]!;
    if (candidate.depth < row.depth) return undefined;
    if (candidate.depth === row.depth) return candidate;
  }
  return undefined;
}

function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

export interface Projection {
  depth: number;
  parentId: string | null;
  /** Where to place the step among its new siblings. */
  position: Position | undefined;
}

/**
 * Where a dragged row would land: the row is dropped at `overId`'s slot and
 * dragging horizontally by `offsetX` changes the depth by one level per
 * `indentWidth` pixels, clamped to what is valid at that spot.
 *
 * `rows` must not contain the descendants of the dragged row (see
 * {@link withoutDescendants}).
 */
export function getProjection(
  rows: readonly FlatRow[],
  activeId: string,
  overId: string,
  offsetX: number,
  indentWidth: number,
): Projection | null {
  const activeIndex = rows.findIndex((r) => r.id === activeId);
  const overIndex = rows.findIndex((r) => r.id === overId);
  const active = rows[activeIndex];
  if (!active || overIndex === -1) return null;

  const moved = arrayMove(rows, activeIndex, overIndex);
  const previous = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  const projected = active.depth + Math.round(offsetX / indentWidth);
  const maxDepth = previous ? previous.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;
  const depth = Math.min(Math.max(projected, minDepth), maxDepth);

  let parentId: string | null;
  if (depth === 0 || !previous) parentId = null;
  else if (depth === previous.depth) parentId = previous.parentId;
  else if (depth > previous.depth) parentId = previous.id;
  else {
    const ancestorSibling = moved
      .slice(0, overIndex)
      .reverse()
      .find((r) => r.depth === depth);
    parentId = ancestorSibling?.parentId ?? null;
  }

  // The nearest visible sibling above the drop slot, under the same parent.
  let afterId: string | null = null;
  for (let i = overIndex - 1; i >= 0; i--) {
    const row = moved[i]!;
    if (row.depth < depth) break;
    if (row.depth === depth) {
      afterId = row.id;
      break;
    }
  }

  let position: Position | undefined;
  if (afterId !== null) position = { afterId };
  else if (parentId !== null && previous?.id === parentId && previous.collapsed) {
    // Dropped onto a collapsed step: append to its (hidden) children.
    position = undefined;
  } else position = { afterId: null };

  return { depth, parentId, position };
}
