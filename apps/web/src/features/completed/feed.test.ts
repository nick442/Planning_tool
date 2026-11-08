import { describe, expect, it } from 'vitest';
import type { Goal, Step } from '@planning/shared';
import { completedFeed, completedToday, dayLabel } from './feed';

const now = new Date(2026, 10, 8, 15, 0); // Sun 8 Nov 2026
const at = (day: number, hour: number, month = 10, year = 2026) =>
  new Date(year, month, day, hour).toISOString();

const goal = (id: string, extra: Partial<Goal> = {}): Goal => ({
  id,
  title: id,
  kind: 'other',
  color: '#000',
  order: 'a0',
  archived: false,
  createdAt: at(1, 9),
  updatedAt: at(1, 9),
  deleted: false,
  ...extra,
});

const step = (id: string, extra: Partial<Step> = {}): Step => ({
  id,
  goalId: 'Thesis',
  parentId: null,
  order: 'a0',
  title: id,
  status: 'open',
  createdAt: at(1, 9),
  updatedAt: at(1, 9),
  deleted: false,
  ...extra,
});

const done = (id: string, completedAt: string, extra: Partial<Step> = {}) =>
  step(id, { status: 'done', completedAt, ...extra });

const goals = [goal('Thesis'), goal('Exam'), goal('Gone', { deleted: true })];
const steps = [
  step('Lit review'),
  step('Find sources', { parentId: 'Lit review' }),
  done('Search Scopus', at(8, 10), { parentId: 'Find sources' }),
  done('Outline ch. 2', at(8, 14)),
  done('Set up Zotero', at(7, 18)),
  done('Draft RQ', at(3, 11)),
  done('Old one', at(20, 9, 11, 2025)),
  done('Formula sheet', at(8, 12), { goalId: 'Exam' }),
  done('Deleted step', at(8, 13), { deleted: true }),
  done('From deleted goal', at(8, 13), { goalId: 'Gone' }),
  step('Still open'),
];

describe('dayLabel', () => {
  it('names today, yesterday and older days', () => {
    expect(dayLabel(new Date(2026, 10, 8, 1), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 7, 23), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 10, 3), now)).toBe('Tue 3 Nov');
    expect(dayLabel(new Date(2025, 11, 20), now)).toBe('Sat 20 Dec 2025');
  });
});

describe('completedFeed', () => {
  it('groups done steps by day, newest first', () => {
    const feed = completedFeed(steps, goals, now);
    expect(feed.total).toBe(6);
    expect(feed.groups.map((g) => [g.label, g.entries.map((e) => e.step.id)])).toEqual([
      ['Today', ['Outline ch. 2', 'Formula sheet', 'Search Scopus']],
      ['Yesterday', ['Set up Zotero']],
      ['Tue 3 Nov', ['Draft RQ']],
      ['Sat 20 Dec 2025', ['Old one']],
    ]);
  });

  it('adds the goal and the breadcrumb of ancestors', () => {
    const entry = completedFeed(steps, goals, now).groups[0]!.entries[2]!;
    expect(entry.goal.id).toBe('Thesis');
    expect(entry.breadcrumb).toEqual(['Lit review', 'Find sources']);
  });

  it('lists a finished branch above the steps completed with it', () => {
    const t = at(8, 16);
    const feed = completedFeed(
      [done('Child', t, { parentId: 'Parent' }), done('Parent', t, { autoCompleted: true })],
      goals,
      now,
    );
    expect(feed.groups[0]!.entries.map((e) => e.step.id)).toEqual(['Parent', 'Child']);
  });

  it('filters by goal', () => {
    const feed = completedFeed(steps, goals, now, { goalId: 'Exam' });
    expect(feed.total).toBe(1);
    expect(feed.groups[0]!.entries[0]!.step.id).toBe('Formula sheet');
  });

  it('applies the limit but reports the full total', () => {
    const feed = completedFeed(steps, goals, now, { limit: 2 });
    expect(feed.total).toBe(6);
    expect(feed.groups.flatMap((g) => g.entries)).toHaveLength(2);
  });

  it('counts the steps completed today', () => {
    expect(completedToday(steps, now)).toBe(4);
  });
});
