import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupFileName, listBackups, pruneBackups, runBackupIfDue } from '../src/backup';
import { openDatabase } from '../src/db/client';
import { SyncService } from '../src/sync';
import { migrations, step } from './helpers';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'planning-backup-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('backups', () => {
  it('names files by local day', () => {
    expect(backupFileName(new Date(2026, 10, 8, 23, 59))).toBe('planning-2026-11-08.db');
  });

  it('makes a readable copy of the live database once a day, after the hour', async () => {
    const live = openDatabase(join(dir, 'live.db'), migrations);
    new SyncService(live.db).push({ goals: [], steps: [step('s1')] });
    const backups = join(dir, 'backups');
    const options = { sqlite: live.sqlite, dir: backups, keep: 30, hour: 3 };

    // Too early in the night.
    expect(await runBackupIfDue({ ...options, now: () => new Date(2026, 10, 8, 2, 0) })).toBeNull();

    const file = await runBackupIfDue({ ...options, now: () => new Date(2026, 10, 8, 3, 30) });
    expect(file).toBe(join(backups, 'planning-2026-11-08.db'));
    // Already done today.
    expect(
      await runBackupIfDue({ ...options, now: () => new Date(2026, 10, 8, 22, 0) }),
    ).toBeNull();

    const copy = new Database(file!, { readonly: true });
    expect(copy.prepare('select id from steps').all()).toEqual([{ id: 's1' }]);
    copy.close();
    expect(existsSync(`${file}.partial`)).toBe(false);
    live.close();
  });

  it('keeps only the newest copies', () => {
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) {
      writeFileSync(join(dir, `planning-${day}.db`), '');
    }
    writeFileSync(join(dir, 'notes.txt'), 'not a backup');
    expect(pruneBackups(dir, 2)).toEqual(['planning-2026-11-02.db', 'planning-2026-11-01.db']);
    expect(listBackups(dir)).toEqual(['planning-2026-11-04.db', 'planning-2026-11-03.db']);
    expect(existsSync(join(dir, 'notes.txt'))).toBe(true);
  });
});
