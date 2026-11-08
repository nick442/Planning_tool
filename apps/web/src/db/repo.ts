import type { Goal, Step } from '@planning/shared';
import { db, outboxKey, type OutboxEntry, type SyncedTable } from './db';

/**
 * Persistence: one transaction writes the records and queues their outbox
 * entries, so a pending change is never lost once it has been written.
 */

function outboxEntries(table: SyncedTable, records: readonly { id: string }[]): OutboxEntry[] {
  const queuedAt = new Date().toISOString();
  return records.map((r) => ({ key: outboxKey(table, r.id), table, recordId: r.id, queuedAt }));
}

export async function saveRecords(goals: readonly Goal[], steps: readonly Step[]): Promise<void> {
  if (goals.length === 0 && steps.length === 0) return;
  await db.transaction('rw', db.goals, db.steps, db.outbox, async () => {
    if (goals.length > 0) await db.goals.bulkPut([...goals]);
    if (steps.length > 0) await db.steps.bulkPut([...steps]);
    await db.outbox.bulkPut([...outboxEntries('goals', goals), ...outboxEntries('steps', steps)]);
  });
}
