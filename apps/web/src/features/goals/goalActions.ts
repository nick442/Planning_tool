import { createGoal, moveGoal, type CreateGoalInput, type Goal } from '@planning/shared';
import { commitGoals, getGoals } from '@/db/dataStore';

export type GoalEdit = Partial<
  Pick<Goal, 'title' | 'kind' | 'course' | 'color' | 'emoji' | 'deadline' | 'archived'>
>;

export function addGoal(input: CreateGoalInput): Goal {
  const goal = createGoal(getGoals(), input);
  commitGoals([goal]);
  return goal;
}

/** Applies an edit. Empty or `undefined` values clear optional fields (course, emoji, deadline). */
export function editGoal(id: string, edit: GoalEdit): void {
  const goal = getGoals().find((g) => g.id === id);
  if (!goal) return;
  const next: Goal = { ...goal, ...edit, updatedAt: new Date().toISOString() };
  for (const key of ['course', 'emoji', 'deadline'] as const) {
    if (key in edit && !edit[key]) delete next[key];
  }
  commitGoals([next]);
}

/** Soft-deletes a goal. Its steps stay in the database but are no longer shown. */
export function deleteGoal(id: string): void {
  const goal = getGoals().find((g) => g.id === id);
  if (goal) commitGoals([{ ...goal, deleted: true, updatedAt: new Date().toISOString() }]);
}

/** Drag and drop in the sidebar. `visible` is the list as shown (from `sortGoals`). */
export function reorderGoal(visible: readonly Goal[], from: number, to: number): void {
  const moved = moveGoal(visible, from, to);
  if (moved) commitGoals([moved]);
}
