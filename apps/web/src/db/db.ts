import Dexie, { type Table } from 'dexie';
import type { Goal, Step } from '@planning/shared';

export type SyncedTable = 'goals' | 'steps';

/**
 * One pending change waiting to be pushed to the Mac mini (Milestone 5).
 * Keyed by table + record id, so editing the same record twice before a push
 * leaves a single entry; the push sends the record's current state.
 */
export interface OutboxEntry {
  key: string;
  table: SyncedTable;
  recordId: string;
  queuedAt: string;
}

/** Small key/value store for sync bookkeeping (e.g. the last pulled revision). */
export interface MetaEntry {
  key: string;
  value: unknown;
}

export class PlanningDB extends Dexie {
  goals!: Table<Goal, string>;
  steps!: Table<Step, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'planning-tool') {
    // Relaxed durability: commits are much faster in Chromium. Data survives a
    // closed tab or crashed browser; only an OS crash in the same instant
    // could lose the very last write.
    super(name, { chromeTransactionDurability: 'relaxed' });
    this.version(1).stores({
      goals: 'id, order, updatedAt',
      steps: 'id, goalId, parentId, updatedAt, completedAt',
      outbox: 'key, table, queuedAt',
    });
    this.version(2).stores({ meta: 'key' });
  }
}

export const db = new PlanningDB();

export const outboxKey = (table: SyncedTable, recordId: string) => `${table}:${recordId}`;
