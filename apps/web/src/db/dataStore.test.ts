import { describe, expect, it } from 'vitest';
import { mergeNewer } from './dataStore';

const r = (id: string, updatedAt: string, v = '') => ({ id, updatedAt, v });

describe('mergeNewer', () => {
  it('keeps the copy with the newer updatedAt', () => {
    const current = [r('a', '2026-01-02', 'mine'), r('b', '2026-01-01', 'mine')];
    const incoming = [r('a', '2026-01-01', 'db'), r('b', '2026-01-03', 'db')];
    expect(mergeNewer(current, incoming).map((x) => x.v)).toEqual(['mine', 'db']);
  });

  it('adds records that only exist in the database and keeps pending local ones', () => {
    const merged = mergeNewer([r('local', '1')], [r('remote', '1')]);
    expect(merged.map((x) => x.id)).toEqual(['local', 'remote']);
  });

  it('returns the same array when nothing changed (no re-render)', () => {
    const current = [r('a', '2')];
    expect(mergeNewer(current, [r('a', '2')])).toBe(current);
    expect(mergeNewer(current, [r('a', '1')])).toBe(current);
  });
});

describe('write-ahead journal', () => {
  it('journals a change synchronously and clears it once IndexedDB has it', async () => {
    const { commitGoals, whenSaved, JOURNAL_KEY } = await import('./dataStore');
    const { db } = await import('./db');
    const goal = {
      id: 'g-journal',
      title: 'Journalled',
      kind: 'other' as const,
      color: '#000',
      order: 'a0',
      archived: false,
      createdAt: '2026-11-08T09:00:00.000Z',
      updatedAt: '2026-11-08T09:00:00.000Z',
      deleted: false,
    };
    commitGoals([goal]);
    expect(JSON.parse(localStorage.getItem(JOURNAL_KEY)!).goals['g-journal'].title).toBe(
      'Journalled',
    );
    await whenSaved();
    expect(localStorage.getItem(JOURNAL_KEY)).toBeNull();
    expect((await db.goals.get('g-journal'))?.title).toBe('Journalled');
  });

  it('replays leftovers from an interrupted session on start', async () => {
    const { startDataSync, useDataStore, whenSaved, JOURNAL_KEY } = await import('./dataStore');
    const { db } = await import('./db');
    const step = {
      id: 's-left',
      goalId: 'g',
      parentId: null,
      order: 'a0',
      title: 'Typed just before the reload',
      status: 'open' as const,
      createdAt: '2026-11-08T09:00:00.000Z',
      updatedAt: '2026-11-08T09:00:00.000Z',
      deleted: false,
    };
    localStorage.setItem(JOURNAL_KEY, JSON.stringify({ goals: {}, steps: { [step.id]: step } }));
    const stop = startDataSync();
    expect(useDataStore.getState().steps.find((s) => s.id === 's-left')?.title).toBe(
      'Typed just before the reload',
    );
    await whenSaved();
    stop();
    expect((await db.steps.get('s-left'))?.title).toBe('Typed just before the reload');
    expect(localStorage.getItem(JOURNAL_KEY)).toBeNull();
  });
});
