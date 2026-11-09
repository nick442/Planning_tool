import { describe, expect, it } from 'vitest';
import {
  compareOrder,
  firstKey,
  keyAfterAll,
  keyAt,
  keyBetween,
  keyForMove,
  keysBetween,
  sortByOrder,
} from '../src/order';

/** Seeded PRNG so the randomised tests are reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

describe('compareOrder / sortByOrder', () => {
  it('sorts by key using code-unit order, not locale order', () => {
    // 'Z' < 'a' in ASCII; localeCompare would put 'a0' first.
    const items = [
      { id: '1', order: 'a0' },
      { id: '2', order: 'Zz' },
      { id: '3', order: 'a0V' },
    ];
    expect(sortByOrder(items).map((i) => i.id)).toEqual(['2', '1', '3']);
  });

  it('breaks ties by id so every device agrees', () => {
    const a = { id: 'B', order: 'a1' };
    const b = { id: 'A', order: 'a1' };
    expect(compareOrder(a, b)).toBeGreaterThan(0);
    expect(sortByOrder([a, b]).map((i) => i.id)).toEqual(['A', 'B']);
  });

  it('does not mutate the input', () => {
    const items = Object.freeze([
      { id: '1', order: 'a1' },
      { id: '2', order: 'a0' },
    ]);
    expect(() => sortByOrder(items)).not.toThrow();
  });
});

describe('keyBetween / keysBetween', () => {
  it('generates keys strictly between the bounds', () => {
    const k = keyBetween('a0', 'a1');
    expect(k > 'a0' && k < 'a1').toBe(true);
    expect(keyBetween(null, 'a0') < 'a0').toBe(true);
    expect(keyBetween('a0', null) > 'a0').toBe(true);
  });

  it('generates n sorted distinct keys', () => {
    const keys = keysBetween('a0', 'a1', 5);
    expect(keys).toHaveLength(5);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(5);
    expect(keys.every((k) => k > 'a0' && k < 'a1')).toBe(true);
  });

  it('firstKey and keyAfterAll', () => {
    expect(firstKey()).toBe('a0');
    expect(keyAfterAll([])).toBe('a0');
    expect(keyAfterAll(['a0', 'a1']) > 'a1').toBe(true);
  });
});

describe('keyAt', () => {
  const keys = ['a0', 'a1', 'a2'];

  it.each([
    [0, (k: string) => k < 'a0'],
    [1, (k: string) => k > 'a0' && k < 'a1'],
    [2, (k: string) => k > 'a1' && k < 'a2'],
    [3, (k: string) => k > 'a2'],
  ])('index %i lands in the right gap', (index, check) => {
    expect(check(keyAt(keys, index))).toBe(true);
  });

  it('works on an empty list', () => {
    expect(keyAt([], 0)).toBe('a0');
  });

  it('clamps out-of-range indexes', () => {
    expect(keyAt(keys, -5) < 'a0').toBe(true);
    expect(keyAt(keys, 99) > 'a2').toBe(true);
  });

  it('tolerates duplicate keys instead of throwing', () => {
    const dupes = ['a0', 'a1', 'a1', 'a2'];
    const k = keyAt(dupes, 2);
    expect(k > 'a1' && k < 'a2').toBe(true);
    const all = ['a1', 'a1'];
    expect(keyAt(all, 1) > 'a1').toBe(true);
    expect(keyAt(all, 0) < 'a1').toBe(true);
  });

  it('keeps the intended order over many random inserts', () => {
    const random = rng(42);
    const list: { id: string; order: string }[] = [];
    for (let i = 0; i < 500; i++) {
      const index = Math.floor(random() * (list.length + 1));
      const order = keyAt(
        list.map((x) => x.order),
        index,
      );
      list.splice(index, 0, { id: `id-${i}`, order });
    }
    expect(sortByOrder(list).map((x) => x.id)).toEqual(list.map((x) => x.id));
    expect(new Set(list.map((x) => x.order)).size).toBe(list.length);
  });

  it('keeps keys short when always inserting at the front', () => {
    const list: string[] = [];
    for (let i = 0; i < 200; i++) list.unshift(keyAt(list, 0));
    expect([...list].sort()).toEqual(list);
    expect(Math.max(...list.map((k) => k.length))).toBeLessThan(6);
  });
});

describe('keyForMove', () => {
  const items = ['A', 'B', 'C', 'D'].map((id, i) => ({ id, order: `a${i}` }));

  it.each([
    [0, 2],
    [3, 0],
    [1, 3],
    [2, 1],
    [0, 3],
  ])('moving %i → %i matches arrayMove', (from, to) => {
    const order = keyForMove(items, from, to);
    const moved = items.map((item, i) => (i === from ? { ...item, order } : item));
    expect(sortByOrder(moved).map((i) => i.id)).toEqual(
      arrayMove(items, from, to).map((i) => i.id),
    );
  });

  it('only ever changes the moved item, over many random moves', () => {
    const random = rng(7);
    let list = Array.from({ length: 20 }, (_, i) => ({ id: `id-${i}`, order: '' }));
    const initial = keysBetween(null, null, list.length);
    list = list.map((x, i) => ({ ...x, order: initial[i]! }));
    for (let n = 0; n < 300; n++) {
      const from = Math.floor(random() * list.length);
      const to = Math.floor(random() * list.length);
      const order = keyForMove(list, from, to);
      const expected = arrayMove(list, from, to).map((x) => x.id);
      list = sortByOrder(list.map((x, i) => (i === from ? { ...x, order } : x)));
      expect(list.map((x) => x.id)).toEqual(expected);
    }
  });
});
