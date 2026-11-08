import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Goal, Step } from '@planning/shared';
import { Check, GitBranch, Undo2 } from 'lucide-react';
import { useUiStore } from '@/app/store';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/toast';
import { GoalBadge } from '@/features/goals/GoalBadge';
import { useToday } from '@/features/goals/deadline';
import { cn } from '@/lib/utils';
import { completedFeed, completedToday, type FeedEntry } from './feed';
import { undoCompletion } from './completion';

const PAGE = 30;
/** Entries completed this recently slide in. */
const FRESH_MS = 3000;

interface CompletedPanelProps {
  goals: Goal[];
  steps: Step[];
  /** The goal on screen, for the "This goal" filter. */
  currentGoal: Goal | null;
}

export function CompletedPanel({ goals, steps, currentGoal }: CompletedPanelProps) {
  const today = useToday();
  const scope = useUiStore((s) => s.feedScope);
  const setScope = useUiStore((s) => s.setFeedScope);
  const selectGoal = useUiStore((s) => s.selectGoal);
  const [limit, setLimit] = useState(PAGE);

  const goalId = scope === 'goal' ? (currentGoal?.id ?? null) : null;
  const feed = useMemo(
    () => completedFeed(steps, goals, today, { goalId, limit }),
    [steps, goals, today, goalId, limit],
  );
  const todayCount = useMemo(() => completedToday(steps, today), [steps, today]);

  return (
    <section aria-label="Completed" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Completed
        </h2>
        {todayCount > 0 && (
          <span className="text-xs tabular-nums text-success">{todayCount} today</span>
        )}
      </header>

      {currentGoal && (
        <div role="radiogroup" aria-label="Show" className="flex rounded-md bg-muted p-0.5 text-xs">
          {(
            [
              ['all', 'All goals'],
              ['goal', 'This goal'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                'flex-1 rounded px-2 py-1 transition-colors',
                scope === value ? 'bg-background shadow-xs' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {feed.total === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Finished steps collect here. Tick off something small to get going.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {feed.groups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">{group.label}</h3>
              <ul className="flex flex-col">
                {group.entries.map((entry) => (
                  <FeedItem
                    key={entry.step.id}
                    entry={entry}
                    onOpenGoal={() => selectGoal(entry.goal.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
          {feed.total > limit && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setLimit(limit + PAGE)}
            >
              Show more ({feed.total - limit})
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function FeedItem({ entry, onOpenGoal }: { entry: FeedEntry; onOpenGoal: () => void }) {
  const { step, goal, breadcrumb, completedAt } = entry;
  // Wall-clock time is read once per mount: only entries that appear just after
  // being completed get the slide-in.
  const [fresh] = useState(() => Date.now() - completedAt.getTime() < FRESH_MS);
  const path = [goal.title, ...breadcrumb].join(' › ');

  const undo = () => {
    if (undoCompletion(step.id))
      showToast({ message: `Reopened: ${step.title || 'Untitled'}`, duration: 3000 });
  };

  return (
    <li
      className={cn(
        'group flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-accent/50',
        fresh &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-3 motion-safe:duration-500',
      )}
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-success/15 text-success">
        {step.autoCompleted ? (
          <GitBranch className="size-3" />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </span>
      <button type="button" onClick={onOpenGoal} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm">{step.title || 'Untitled'}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <GoalBadge goal={goal} className="size-1.5 text-[10px]" />
          <span className="truncate" title={path}>
            {path}
          </span>
        </span>
      </button>
      <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground/70">
        {format(completedAt, 'HH:mm')}
      </span>
      <button
        type="button"
        aria-label={`Undo "${step.title || 'Untitled'}"`}
        title="Undo"
        onClick={undo}
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
      >
        <Undo2 className="size-3.5" />
      </button>
    </li>
  );
}
