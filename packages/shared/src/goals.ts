import { resolveContext, type ContextInput } from './context';
import { keyAfterAll, keyForMove, sortByOrder } from './order';
import type { Goal, GoalKind } from './schema';

/** Goals in sidebar order. Archived and deleted goals are left out unless asked for. */
export function sortGoals(
  goals: readonly Goal[],
  options: { includeArchived?: boolean } = {},
): Goal[] {
  return sortByOrder(goals.filter((g) => !g.deleted && (options.includeArchived || !g.archived)));
}

export interface CreateGoalInput {
  title: string;
  kind?: GoalKind;
  course?: string;
  color?: string;
  deadline?: string;
}

export const DEFAULT_GOAL_COLOR = '#6366f1';

/** A new goal at the bottom of the sidebar. */
export function createGoal(
  goals: readonly Goal[],
  input: CreateGoalInput,
  ctx?: ContextInput,
): Goal {
  const { now, newId } = resolveContext(ctx);
  const existing = sortByOrder(goals.filter((g) => !g.deleted));
  return {
    id: newId(),
    title: input.title,
    kind: input.kind ?? 'other',
    ...(input.course !== undefined ? { course: input.course } : {}),
    color: input.color ?? DEFAULT_GOAL_COLOR,
    ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
    order: keyAfterAll(existing.map((g) => g.order)),
    archived: false,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
}

/**
 * Drag and drop in the sidebar: moves the goal at `fromIndex` to `toIndex`
 * within `visibleGoals` (as returned by {@link sortGoals}). Only the moved
 * goal changes. Returns the updated goal, or null when nothing moves.
 */
export function moveGoal(
  visibleGoals: readonly Goal[],
  fromIndex: number,
  toIndex: number,
  ctx?: ContextInput,
): Goal | null {
  const goal = visibleGoals[fromIndex];
  if (!goal || fromIndex === toIndex) return null;
  const { now } = resolveContext(ctx);
  return { ...goal, order: keyForMove(visibleGoals, fromIndex, toIndex), updatedAt: now };
}
