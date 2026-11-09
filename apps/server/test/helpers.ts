import { fileURLToPath } from 'node:url';
import type { Goal, Step } from '@planning/shared';
import { openDatabase } from '../src/db/client';
import { SyncService } from '../src/sync';

export const migrations = fileURLToPath(new URL('../drizzle', import.meta.url));

export function memorySync() {
  const database = openDatabase(':memory:', migrations);
  return { ...database, sync: new SyncService(database.db) };
}

export const at = (minute: number) => new Date(Date.UTC(2026, 10, 8, 9, minute)).toISOString();

export function goal(id: string, updatedAt = at(0), extra: Partial<Goal> = {}): Goal {
  return {
    id,
    title: id,
    kind: 'other',
    color: '#6366f1',
    order: 'a0',
    archived: false,
    createdAt: at(0),
    updatedAt,
    deleted: false,
    ...extra,
  };
}

export function step(id: string, updatedAt = at(0), extra: Partial<Step> = {}): Step {
  return {
    id,
    goalId: 'g1',
    parentId: null,
    order: 'a0',
    title: id,
    status: 'open',
    createdAt: at(0),
    updatedAt,
    deleted: false,
    ...extra,
  };
}
