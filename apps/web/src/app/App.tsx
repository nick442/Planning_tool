import { useEffect, useMemo } from 'react';
import { goalProgress, sortGoals } from '@planning/shared';
import { ChevronLeft } from 'lucide-react';
import { ConfirmHost } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { startDataSync } from '@/db/dataStore';
import { useAllSteps, useGoals } from '@/db/hooks';
import { GoalHeader } from '@/features/goals/GoalHeader';
import { GoalSidebar } from '@/features/goals/GoalSidebar';
import { Outline } from '@/features/tree/Outline';
import { cn } from '@/lib/utils';
import { useUiStore } from './store';

export function App() {
  useEffect(() => startDataSync(), []);
  const { goals, loaded } = useGoals();
  const steps = useAllSteps();
  const selectedGoalId = useUiStore((s) => s.selectedGoalId);
  const showArchived = useUiStore((s) => s.showArchived);
  const selectGoal = useUiStore((s) => s.selectGoal);

  const visibleGoals = useMemo(
    () => sortGoals(goals, { includeArchived: showArchived }),
    [goals, showArchived],
  );
  const selected = goals.find((g) => g.id === selectedGoalId && !g.deleted) ?? null;
  // On wide screens fall back to the first goal; on phones the goal list shows instead.
  const goal = selected ?? visibleGoals[0] ?? null;
  const progress = useMemo(() => (goal ? goalProgress(steps, goal.id) : null), [steps, goal]);

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'w-full shrink-0 border-r bg-muted/30 p-3 md:block md:w-64',
          selected ? 'hidden' : 'block',
        )}
      >
        <GoalSidebar goals={goals} steps={steps} />
      </aside>

      <main
        className={cn(
          'min-w-0 flex-1 px-4 py-6 sm:px-8 md:block md:py-10',
          selected ? 'block' : 'hidden',
        )}
      >
        <div className="mx-auto max-w-3xl space-y-6">
          {selected && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground md:hidden"
              onClick={() => selectGoal(null)}
            >
              <ChevronLeft /> Goals
            </Button>
          )}
          {goal && progress ? (
            <>
              <GoalHeader goal={goal} progress={progress} />
              <Outline key={goal.id} goal={goal} steps={steps} />
            </>
          ) : (
            loaded && (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-lg">Nothing planned yet.</p>
                <p className="text-sm">Create a goal on the left to get started.</p>
              </div>
            )
          )}
        </div>
      </main>

      <ConfirmHost />
    </div>
  );
}
