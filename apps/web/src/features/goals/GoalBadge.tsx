import type { Goal } from '@planning/shared';
import { cn } from '@/lib/utils';

/** The goal's emoji, or a dot in its accent colour. */
export function GoalBadge({ goal, className }: { goal: Goal; className?: string }) {
  if (goal.emoji) {
    return (
      <span aria-hidden className={cn('w-4 text-center leading-none', className)}>
        {goal.emoji}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: goal.color }}
    />
  );
}
