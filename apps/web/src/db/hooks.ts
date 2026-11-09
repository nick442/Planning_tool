import type { Goal, Step } from '@planning/shared';
import { useDataStore } from './dataStore';

/** Every goal record (including archived and deleted); filter with `sortGoals`. */
export function useGoals(): { goals: Goal[]; loaded: boolean } {
  const goals = useDataStore((s) => s.goals);
  const loaded = useDataStore((s) => s.loaded);
  return { goals, loaded };
}

/** Every step record. Single user, so this stays small enough to keep in memory. */
export function useAllSteps(): Step[] {
  return useDataStore((s) => s.steps);
}
