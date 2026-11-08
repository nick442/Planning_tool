import { useEffect, useMemo } from 'react';
import { goalProgress, sortGoals } from '@planning/shared';
import { CircleCheckBig, ChevronLeft, Plus } from 'lucide-react';
import { ConfirmHost } from '@/components/ConfirmDialog';
import { Toaster } from '@/components/Toaster';
import { Button } from '@/components/ui/button';
import { startDataSync } from '@/db/dataStore';
import { useAllSteps, useGoals } from '@/db/hooks';
import { CompletedPanel } from '@/features/completed/CompletedPanel';
import { completedToday } from '@/features/completed/feed';
import { GoalHeader } from '@/features/goals/GoalHeader';
import { GoalSidebar } from '@/features/goals/GoalSidebar';
import { useToday } from '@/features/goals/deadline';
import { Outline } from '@/features/tree/Outline';
import { addStepAt } from '@/features/tree/stepActions';
import { cn } from '@/lib/utils';
import { SyncIndicator } from '@/sync/SyncIndicator';
import { useUiStore } from './store';
import { TabBar } from './TabBar';

export function App() {
  useEffect(() => startDataSync(), []);
  const { goals, loaded } = useGoals();
  const steps = useAllSteps();
  const selectedGoalId = useUiStore((s) => s.selectedGoalId);
  const showArchived = useUiStore((s) => s.showArchived);
  const selectGoal = useUiStore((s) => s.selectGoal);
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const today = useToday();

  const visibleGoals = useMemo(
    () => sortGoals(goals, { includeArchived: showArchived }),
    [goals, showArchived],
  );
  const selected = goals.find((g) => g.id === selectedGoalId && !g.deleted) ?? null;
  // On wide screens fall back to the first goal; on phones the goal list shows instead.
  const goal = selected ?? visibleGoals[0] ?? null;
  const progress = useMemo(() => (goal ? goalProgress(steps, goal.id) : null), [steps, goal]);
  const doneToday = useMemo(() => completedToday(steps, today), [steps, today]);

  const feedView = view === 'completed';
  // Phones show one screen at a time: the goal list, or the goal / feed.
  const phoneShowsMain = selected !== null || feedView;

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'w-full shrink-0 flex-col gap-2 border-r bg-muted/30 p-3 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))] md:flex md:w-64 md:pb-3',
          phoneShowsMain ? 'hidden' : 'flex',
        )}
      >
        <GoalSidebar goals={goals} steps={steps} />
        <div className="mt-auto flex flex-col gap-1 border-t pt-2">
          <Button
            variant={feedView ? 'secondary' : 'ghost'}
            size="sm"
            className="hidden w-full justify-start text-muted-foreground md:flex lg:hidden"
            aria-pressed={feedView}
            onClick={() => setView(feedView ? 'goal' : 'completed')}
          >
            <CircleCheckBig /> Completed
            {doneToday > 0 && (
              <span className="ml-auto text-xs tabular-nums text-success">{doneToday} today</span>
            )}
          </Button>
          <SyncIndicator />
        </div>
      </aside>

      <main
        className={cn(
          'min-w-0 flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 md:block md:py-10',
          phoneShowsMain ? 'block' : 'hidden',
        )}
      >
        <div className="mx-auto max-w-3xl space-y-6">
          {phoneShowsMain && (
            // Phone top bar: back to the list, and the sync status.
            <div className="-mx-2 flex items-center justify-between md:hidden">
              {selected && !feedView ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => selectGoal(null)}
                >
                  <ChevronLeft /> Goals
                </Button>
              ) : (
                <span />
              )}
              <SyncIndicator />
            </div>
          )}

          {feedView && (
            <div className="lg:hidden">
              <CompletedPanel goals={goals} steps={steps} currentGoal={goal} />
            </div>
          )}

          <div className={cn('space-y-6', feedView && 'hidden lg:block')}>
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
        </div>
      </main>

      <aside className="hidden w-80 shrink-0 border-l p-4 lg:block">
        <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <CompletedPanel goals={goals} steps={steps} currentGoal={goal} />
        </div>
      </aside>

      {/* Phones: add a step with one thumb. */}
      {goal && selected && !feedView && (
        <Button
          size="icon"
          aria-label="New step"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 size-14 rounded-full shadow-lg md:hidden"
          onClick={() => useUiStore.getState().editStep(addStepAt(goal.id, null))}
        >
          <Plus className="size-6" />
        </Button>
      )}

      <TabBar doneToday={doneToday} />
      <ConfirmHost />
      <Toaster />
    </div>
  );
}
