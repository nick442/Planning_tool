import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/client';
import { SyncService } from '../src/sync';
import { at, goal, memorySync, migrations, step } from './helpers';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('SyncService', () => {
  it('stores new records with increasing revisions', () => {
    const { sync } = memorySync();
    const result = sync.push({ goals: [goal('g1')], steps: [step('s1'), step('s2')] });
    expect(result).toEqual({ accepted: ['g1', 's1', 's2'], rev: 3 });

    const pulled = sync.pull(0);
    expect(pulled.goals.map((g) => [g.id, g.rev])).toEqual([['g1', 1]]);
    expect(pulled.steps.map((s) => [s.id, s.rev])).toEqual([
      ['s1', 2],
      ['s2', 3],
    ]);
    expect(pulled).toMatchObject({ rev: 3, hasMore: false });
  });

  it('keeps the newer copy of each record (last write wins)', () => {
    const { sync } = memorySync();
    sync.push({ goals: [], steps: [step('s1', at(5), { title: 'laptop' })] });

    // An older edit from the phone loses…
    expect(
      sync.push({ goals: [], steps: [step('s1', at(3), { title: 'phone' })] }).accepted,
    ).toEqual([]);
    // …a tie keeps the server copy…
    expect(sync.push({ goals: [], steps: [step('s1', at(5), { title: 'tie' })] }).accepted).toEqual(
      [],
    );
    // …and a newer one wins.
    expect(
      sync.push({ goals: [], steps: [step('s1', at(9), { title: 'phone later' })] }).accepted,
    ).toEqual(['s1']);
    expect(sync.pull(0).steps[0]).toMatchObject({ title: 'phone later', rev: 2 });
  });

  it('only returns what changed since a revision', () => {
    const { sync } = memorySync();
    sync.push({ goals: [], steps: [step('a'), step('b')] });
    const { rev } = sync.pull(0);
    sync.push({ goals: [], steps: [step('b', at(1), { status: 'done', completedAt: at(1) })] });
    const changed = sync.pull(rev);
    expect(changed.steps.map((s) => [s.id, s.status])).toEqual([['b', 'done']]);
    expect(sync.pull(changed.rev).steps).toEqual([]);
  });

  it('reports its real revision so devices notice a reset server', () => {
    const { sync } = memorySync();
    expect(sync.pull(42)).toMatchObject({ rev: 0, hasMore: false });
  });

  it('gives each database its own epoch', () => {
    const a = memorySync().sync;
    const b = memorySync().sync;
    expect(a.epoch).toMatch(/^[0-9a-f]{16}$/);
    expect(a.epoch).not.toBe(b.epoch);
    expect(a.pull(0).epoch).toBe(a.epoch);
  });

  it('syncs deletions as records with deleted: true', () => {
    const { sync } = memorySync();
    sync.push({ goals: [], steps: [step('a')] });
    sync.push({ goals: [], steps: [step('a', at(2), { deleted: true })] });
    expect(sync.pull(1).steps[0]).toMatchObject({ id: 'a', deleted: true });
  });

  it('pages through large pulls in revision order across both tables', () => {
    const { sync } = memorySync();
    sync.push({ goals: [goal('g1')], steps: [step('s1'), step('s2')] });
    sync.push({ goals: [goal('g2')], steps: [] });

    const first = sync.pull(0, 2);
    expect(first).toMatchObject({ rev: 2, hasMore: true });
    expect([...first.goals, ...first.steps].map((r) => r.id).sort()).toEqual(['g1', 's1']);
    const second = sync.pull(first.rev, 2);
    expect(second).toMatchObject({ rev: 4, hasMore: false });
    expect([...second.goals, ...second.steps].map((r) => r.id).sort()).toEqual(['g2', 's2']);
  });

  it('notifies subscribers only when something was stored', () => {
    const { sync } = memorySync();
    const seen: number[] = [];
    const stop = sync.subscribe((rev) => seen.push(rev));
    sync.push({ goals: [], steps: [step('a', at(2))] });
    sync.push({ goals: [], steps: [step('a', at(1))] }); // older: ignored
    stop();
    sync.push({ goals: [], steps: [step('b')] });
    expect(seen).toEqual([1]);
  });

  it('continues the revision counter after a restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'planning-'));
    try {
      const file = join(dir, 'planning.db');
      const first = openDatabase(file, migrations);
      const before = new SyncService(first.db);
      const epochBefore = before.epoch;
      before.push({ goals: [goal('g')], steps: [step('s')] });
      first.close();

      const second = openDatabase(file, migrations);
      const sync = new SyncService(second.db);
      expect(sync.currentRev).toBe(2);
      // Same database, same epoch.
      expect(sync.epoch).toBe(epochBefore);
      expect(sync.push({ goals: [], steps: [step('t')] }).rev).toBe(3);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
