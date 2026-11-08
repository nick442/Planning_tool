import { format, isSameDay, isSameYear, parseISO, startOfDay, subDays } from 'date-fns';
import type { Goal, Step } from '@planning/shared';

export interface FeedEntry {
  step: Step;
  goal: Goal;
  /** Titles of the step's ancestors, top-level first (goal not included). */
  breadcrumb: string[];
  completedAt: Date;
}

export interface FeedGroup {
  /** yyyy-MM-dd of the local day. */
  key: string;
  /** "Today", "Yesterday", "Mon 3 Nov", or "Mon 3 Nov 2025" for other years. */
  label: string;
  entries: FeedEntry[];
}

export interface FeedOptions {
  /** Only this goal's steps. */
  goalId?: string | null;
  /** Maximum number of entries (newest first). */
  limit?: number;
}

export interface Feed {
  groups: FeedGroup[];
  /** Entries matching the filter, before the limit. */
  total: number;
}

export function dayLabel(day: Date, now: Date): string {
  if (isSameDay(day, now)) return 'Today';
  if (isSameDay(day, subDays(now, 1))) return 'Yesterday';
  return format(day, isSameYear(day, now) ? 'EEE d MMM' : 'EEE d MMM yyyy');
}

/**
 * The Completed feed: done steps, newest first, grouped by local day. Steps
 * of deleted goals are left out; archived goals still count (their work was
 * still done).
 */
export function completedFeed(
  steps: readonly Step[],
  goals: readonly Goal[],
  now: Date,
  options: FeedOptions = {},
): Feed {
  const goalsById = new Map(goals.filter((g) => !g.deleted).map((g) => [g.id, g]));
  const stepsById = new Map(steps.map((s) => [s.id, s]));

  const done = steps
    .filter(
      (s) =>
        s.status === 'done' &&
        !s.deleted &&
        s.completedAt !== undefined &&
        goalsById.has(s.goalId) &&
        (!options.goalId || s.goalId === options.goalId),
    )
    .map((step) => ({ step, breadcrumb: breadcrumbOf(step, stepsById) }))
    // Newest first (ISO timestamps sort as strings). Steps finished in the same
    // action share a timestamp: show the finished branch above its steps.
    .sort((a, b) => {
      const ta = a.step.completedAt!;
      const tb = b.step.completedAt!;
      if (ta !== tb) return ta < tb ? 1 : -1;
      if (a.breadcrumb.length !== b.breadcrumb.length) {
        return a.breadcrumb.length - b.breadcrumb.length;
      }
      return a.step.id < b.step.id ? -1 : 1;
    });

  const limited = options.limit === undefined ? done : done.slice(0, options.limit);
  const groups: FeedGroup[] = [];
  for (const { step, breadcrumb } of limited) {
    const completedAt = parseISO(step.completedAt!);
    const key = format(startOfDay(completedAt), 'yyyy-MM-dd');
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(completedAt, now), entries: [] };
      groups.push(group);
    }
    group.entries.push({
      step,
      goal: goalsById.get(step.goalId)!,
      breadcrumb,
      completedAt,
    });
  }
  return { groups, total: done.length };
}

function breadcrumbOf(step: Step, stepsById: Map<string, Step>): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();
  let parentId = step.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = stepsById.get(parentId);
    if (!parent) break;
    titles.unshift(parent.title || 'Untitled');
    parentId = parent.parentId;
  }
  return titles;
}

/** Number of steps completed on the local day of `now`. */
export function completedToday(steps: readonly Step[], now: Date): number {
  return steps.filter(
    (s) =>
      s.status === 'done' && !s.deleted && s.completedAt && isSameDay(parseISO(s.completedAt), now),
  ).length;
}
