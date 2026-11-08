import { describe, expect, it } from 'vitest';
import type { Goal, Step } from '@planning/shared';
import { buildExport, exportFileName, ImportError, planImport } from './transfer';

const T = (min: number) => new Date(Date.UTC(2026, 10, 8, 9, min)).toISOString();

const goal = (id: string, updatedAt = T(0)): Goal => ({
  id,
  title: id,
  kind: 'thesis',
  color: '#6366f1',
  order: 'a0',
  archived: false,
  createdAt: T(0),
  updatedAt,
  deleted: false,
});

const step = (id: string, updatedAt = T(0), extra: Partial<Step> = {}): Step => ({
  id,
  goalId: 'g1',
  parentId: null,
  order: 'a0',
  title: id,
  status: 'open',
  createdAt: T(0),
  updatedAt,
  deleted: false,
  ...extra,
});

describe('export', () => {
  it('builds a complete, versioned file', () => {
    const file = buildExport(
      [goal('g1')],
      [step('s1'), step('gone', T(1), { deleted: true })],
      new Date(T(5)),
    );
    expect(file).toMatchObject({ format: 'planning-tool-export', version: 1, exportedAt: T(5) });
    expect(file.steps.map((s) => s.id)).toEqual(['s1', 'gone']);
  });

  it('names the file by date', () => {
    expect(exportFileName(new Date(2026, 10, 8))).toBe('planning-export-2026-11-08.json');
  });
});

describe('planImport', () => {
  const file = (goals: Goal[], steps: Step[]) => JSON.stringify(buildExport(goals, steps));

  it('adds new records, updates older ones and leaves newer ones alone', async () => {
    const current = {
      goals: [goal('g1', T(0))],
      steps: [step('older-here', T(1)), step('newer-here', T(9)), step('same', T(3))],
    };
    const plan = await planImport(
      file(
        [goal('g1', T(0)), goal('g2')],
        [
          step('older-here', T(5), { title: 'from file' }),
          step('newer-here', T(2), { title: 'stale' }),
          step('same', T(3)),
          step('brand-new'),
        ],
      ),
      current,
    );
    expect(plan).toMatchObject({ added: 2, updated: 1, unchanged: 3 });
    expect(plan.goals.map((g) => g.id)).toEqual(['g2']);
    expect(plan.steps.map((s) => [s.id, s.title])).toEqual([
      ['older-here', 'from file'],
      ['brand-new', 'brand-new'],
    ]);
  });

  it('rejects files that are not exports, with a helpful message', async () => {
    const empty = { goals: [], steps: [] };
    await expect(planImport('not json', empty)).rejects.toThrow(ImportError);
    await expect(planImport('{"hello": 1}', empty)).rejects.toThrow(/isn't a Planning Tool export/);
    const broken = JSON.stringify({ ...buildExport([], []), steps: [{ id: 'x' }] });
    await expect(planImport(broken, empty)).rejects.toThrow(/at steps\.0/);
  });
});
