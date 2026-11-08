import type { Goal, Step } from '@planning/shared';
import { keysBetween } from '@planning/shared';

/**
 * Static sample data for the Milestone 0 shell. Milestone 2 replaces this with
 * the Dexie (IndexedDB) store.
 */
const now = '2026-11-08T09:00:00.000Z';

export const demoGoal: Goal = {
  id: 'demo-thesis',
  title: 'Thesis',
  kind: 'thesis',
  color: '#6366f1',
  deadline: '2026-11-20',
  order: 'a0',
  archived: false,
  createdAt: now,
  updatedAt: now,
  deleted: false,
};

type Spec = [title: string, done?: boolean, children?: Spec[]];

const spec: Spec[] = [
  [
    'Literature review',
    false,
    [
      ['Find sources', false, [['Search Scopus', true], ['Ask supervisor for key refs']]],
      ['Write summaries', false, [['Paper A', true], ['Paper B', true], ['Paper C']]],
    ],
  ],
  ['Methodology', false, [['Draft research questions']]],
];

function toSteps(specs: Spec[], parentId: string | null, out: Step[]): Step[] {
  const keys = keysBetween(null, null, specs.length);
  specs.forEach(([title, done, children], i) => {
    const id = `${parentId ?? 'root'}/${i}`;
    out.push({
      id,
      goalId: demoGoal.id,
      parentId,
      order: keys[i]!,
      title,
      status: done ? 'done' : 'open',
      ...(done ? { completedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });
    if (children) toSteps(children, id, out);
  });
  return out;
}

export const demoSteps: Step[] = toSteps(spec, null, []);
