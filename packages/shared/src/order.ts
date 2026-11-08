import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Fractional-indexing helpers.
 *
 * Goals and steps are ordered by a string sort key (`"a0"`, `"a0V"`, `"a1"`, ...).
 * Moving an item only changes that item's key, which keeps drag and drop cheap
 * and reduces sync conflicts.
 *
 * Keys must be compared with plain code-unit comparison (`<`), never with
 * `localeCompare`, because the key alphabet relies on ASCII order.
 */

export interface Ordered {
  id: string;
  order: string;
}

/**
 * Compare two order keys. Ties (possible when two devices insert at the same
 * spot while offline) are broken by `id`, so every device sorts identically.
 */
export function compareOrder(a: Ordered, b: Ordered): number {
  if (a.order < b.order) return -1;
  if (a.order > b.order) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** Returns a new array sorted by order key (then id). */
export function sortByOrder<T extends Ordered>(items: readonly T[]): T[] {
  return [...items].sort(compareOrder);
}

/** A key that sorts strictly between `a` and `b` (`null` = open end). */
export function keyBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b);
}

/** `n` distinct, sorted keys strictly between `a` and `b` (`null` = open end). */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  return generateNKeysBetween(a, b, n);
}

/** The first key in a fresh, empty list. */
export function firstKey(): string {
  return keyBetween(null, null);
}

/** A key that sorts after every key in `sortedKeys`. */
export function keyAfterAll(sortedKeys: readonly string[]): string {
  return keyBetween(sortedKeys.at(-1) ?? null, null);
}

/**
 * A key that places a new item at position `index` in a list whose keys are
 * `sortedKeys` (ascending). `index` is clamped to `[0, sortedKeys.length]`.
 *
 * When moving an item within the same list, pass the keys *without* the item
 * being moved.
 *
 * Duplicate keys (from concurrent offline inserts) are tolerated: if the keys
 * on either side of `index` are equal, the new key is placed after that run of
 * duplicates instead of throwing.
 */
export function keyAt(sortedKeys: readonly string[], index: number): string {
  const i = Math.max(0, Math.min(Math.trunc(index), sortedKeys.length));
  const prev = i > 0 ? sortedKeys[i - 1]! : null;
  let next: string | null = null;
  for (let j = i; j < sortedKeys.length; j++) {
    const candidate = sortedKeys[j]!;
    if (prev === null || candidate > prev) {
      next = candidate;
      break;
    }
  }
  return keyBetween(prev, next);
}

/**
 * The new order key for an item moved from `fromIndex` to `toIndex` in a list
 * of items already sorted by order key. `toIndex` is the item's position in
 * the list *after* the move, matching what drag-and-drop libraries such as
 * dnd-kit report.
 */
export function keyForMove<T extends Ordered>(
  sortedItems: readonly T[],
  fromIndex: number,
  toIndex: number,
): string {
  const rest = sortedItems.filter((_, i) => i !== fromIndex).map((item) => item.order);
  return keyAt(rest, toIndex);
}
