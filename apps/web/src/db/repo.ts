import { isNewer, type Goal, type Step } from '@planning/shared';
import { db, outboxKey, type OutboxEntry, type PlanningDB, type SyncedTable } from './db';

function outboxEntries(table: SyncedTable, records: readonly { id: string }[]): OutboxEntry[] {
  const queuedAt = new Date().toISOString();
  return records.map((r) => ({ key: outboxKey(table, r.id), table, recordId: r.id, queuedAt }));
}

/** The records that should replace what is stored: never overwrite a newer copy. */
async function notOlder<T extends { id: string; updatedAt: string }>(
  table: { bulkGet: (keys: string[]) => Promise<(T | undefined)[]> },
  records: readonly T[],
): Promise<T[]> {
  if (records.length === 0) return [];
  const existing = await table.bulkGet(records.map((r) => r.id));
  return records.filter((r, i) => {
    const stored = existing[i];
    return !stored || !isNewer(stored, r);
  });
}

/**
 * Saves local changes: one transaction writes the records and queues their
 * outbox entries. A record is skipped if the database already holds a newer
 * copy (pulled from another device meanwhile); the store then picks that
 * copy up through its live query.
 */
export async function saveRecords(goals: readonly Goal[], steps: readonly Step[]): Promise<void> {
  if (goals.length === 0 && steps.length === 0) return;
  await db.transaction('rw', db.goals, db.steps, db.outbox, async () => {
    const g = await notOlder(db.goals, goals);
    const s = await notOlder(db.steps, steps);
    if (g.length > 0) await db.goals.bulkPut(g);
    if (s.length > 0) await db.steps.bulkPut(s);
    await db.outbox.bulkPut([...outboxEntries('goals', g), ...outboxEntries('steps', s)]);
  });
}

/**
 * Applies records pulled from the server (no outbox entries: they came from
 * there). Keeps the local copy when it is newer; it is still in the outbox
 * and will be pushed.
 */
export async function applyRemote(
  goals: readonly Goal[],
  steps: readonly Step[],
  database: PlanningDB = db,
): Promise<void> {
  if (goals.length === 0 && steps.length === 0) return;
  await database.transaction('rw', database.goals, database.steps, async () => {
    const existingGoals = await database.goals.bulkGet(goals.map((r) => r.id));
    const existingSteps = await database.steps.bulkGet(steps.map((r) => r.id));
    const g = goals.filter((r, i) => isNewer(r, existingGoals[i]));
    const s = steps.filter((r, i) => isNewer(r, existingSteps[i]));
    if (g.length > 0) await database.goals.bulkPut(g);
    if (s.length > 0) await database.steps.bulkPut(s);
  });
}
