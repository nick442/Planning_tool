import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Goal, Step } from '@planning/shared';

/**
 * Goals and steps are stored whole, as JSON validated by the shared Zod
 * schemas. The columns next to it are what the server needs to sync:
 * `updated_at` for last-write-wins and `rev` for "what changed since".
 */
function recordTable<T>(name: string) {
  return sqliteTable(
    name,
    {
      id: text('id').primaryKey(),
      data: text('data', { mode: 'json' }).$type<T>().notNull(),
      updatedAt: text('updated_at').notNull(),
      deleted: integer('deleted', { mode: 'boolean' }).notNull(),
      rev: integer('rev').notNull(),
    },
    (t) => [index(`${name}_rev_idx`).on(t.rev)],
  );
}

export const goals = recordTable<Goal>('goals');
export const steps = recordTable<Step>('steps');

/** Small key/value table, e.g. the database's sync epoch. */
export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
