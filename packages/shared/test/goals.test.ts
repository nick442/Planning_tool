import { describe, expect, it } from 'vitest';
import { createGoal, DEFAULT_GOAL_COLOR, moveGoal, sortGoals } from '../src/goals';
import { goalSchema, type Goal } from '../src/schema';
import { idGen, T0, T1 } from './helpers';

function goal(id: string, order: string, extra: Partial<Goal> = {}): Goal {
  return {
    id,
    title: id,
    kind: 'other',
    color: DEFAULT_GOAL_COLOR,
    order,
    archived: false,
    createdAt: T0,
    updatedAt: T0,
    deleted: false,
    ...extra,
  };
}

describe('createGoal', () => {
  it('creates a valid goal at the bottom of the list', () => {
    const existing = [goal('A', 'a0'), goal('B', 'a1')];
    const created = createGoal(
      existing,
      { title: 'Stats exam', kind: 'exam', deadline: '2026-12-15' },
      { now: T1, newId: idGen() },
    );
    expect(goalSchema.parse(created)).toEqual(created);
    expect(created).toMatchObject({
      id: 'new-1',
      title: 'Stats exam',
      kind: 'exam',
      deadline: '2026-12-15',
      archived: false,
      createdAt: T1,
      updatedAt: T1,
    });
    expect(created.order > 'a1').toBe(true);
    expect(created).not.toHaveProperty('course');
  });

  it('works for the very first goal', () => {
    expect(createGoal([], { title: 'Thesis' }).order).toBe('a0');
  });
});

describe('sortGoals', () => {
  it('sorts by order and hides archived and deleted goals', () => {
    const goals = [
      goal('C', 'a2'),
      goal('A', 'a0'),
      goal('Archived', 'a1', { archived: true }),
      goal('Deleted', 'a3', { deleted: true }),
    ];
    expect(sortGoals(goals).map((g) => g.id)).toEqual(['A', 'C']);
    expect(sortGoals(goals, { includeArchived: true }).map((g) => g.id)).toEqual([
      'A',
      'Archived',
      'C',
    ]);
  });
});

describe('moveGoal', () => {
  const goals = [goal('A', 'a0'), goal('B', 'a1'), goal('C', 'a2')];

  it('returns only the moved goal with a new order key', () => {
    const moved = moveGoal(goals, 0, 2, { now: T1 });
    expect(moved).toMatchObject({ id: 'A', updatedAt: T1 });
    const after = sortGoals(goals.map((g) => (g.id === moved!.id ? moved! : g)));
    expect(after.map((g) => g.id)).toEqual(['B', 'C', 'A']);
  });

  it('returns null when nothing moves', () => {
    expect(moveGoal(goals, 1, 1)).toBeNull();
    expect(moveGoal(goals, 5, 0)).toBeNull();
  });
});
