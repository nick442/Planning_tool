import { asc, eq, gt, sql } from 'drizzle-orm';
import {
  isNewer,
  type Goal,
  type PullResponse,
  type PushResponse,
  type Step,
} from '@planning/shared';
import type { Db } from './db/client';
import { goals, steps } from './db/schema';

type Listener = (rev: number) => void;

export const DEFAULT_PULL_LIMIT = 1000;

/**
 * The server side of sync. Every stored change gets the next revision
 * number, so a device only needs to remember the last `rev` it has seen.
 *
 * better-sqlite3 is synchronous and the server is one process, so pushes
 * run one at a time and the in-memory counter can't race.
 */
export class SyncService {
  private rev: number;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly db: Db) {
    const row = db.get<{ rev: number | null }>(
      sql`select max(rev) as rev from (select rev from goals union all select rev from steps)`,
    );
    this.rev = row?.rev ?? 0;
  }

  get currentRev(): number {
    return this.rev;
  }

  /** Stores each record that is newer than the server's copy (last write wins). */
  push(input: { goals: Goal[]; steps: Step[] }): PushResponse {
    const accepted: string[] = [];
    this.db.transaction((tx) => {
      for (const [table, records] of [
        [goals, input.goals],
        [steps, input.steps],
      ] as const) {
        for (const record of records) {
          const existing = tx
            .select({ updatedAt: table.updatedAt })
            .from(table)
            .where(eq(table.id, record.id))
            .get();
          if (!isNewer(record, existing)) continue;
          const rev = ++this.rev;
          const row = {
            id: record.id,
            data: { ...record, rev },
            updatedAt: record.updatedAt,
            deleted: record.deleted,
            rev,
          };
          tx.insert(table)
            .values(row as typeof table.$inferInsert)
            .onConflictDoUpdate({ target: table.id, set: row as typeof table.$inferInsert })
            .run();
          accepted.push(record.id);
        }
      }
    });
    if (accepted.length > 0) this.notify();
    return { accepted, rev: this.rev };
  }

  /** Everything changed after `since`, oldest first, at most `limit` records. */
  pull(since: number, limit = DEFAULT_PULL_LIMIT): PullResponse {
    const goalRows = this.db
      .select({ data: goals.data, rev: goals.rev })
      .from(goals)
      .where(gt(goals.rev, since))
      .orderBy(asc(goals.rev))
      .limit(limit + 1)
      .all();
    const stepRows = this.db
      .select({ data: steps.data, rev: steps.rev })
      .from(steps)
      .where(gt(steps.rev, since))
      .orderBy(asc(steps.rev))
      .limit(limit + 1)
      .all();

    type Row =
      { kind: 'goal'; data: Goal; rev: number } | { kind: 'step'; data: Step; rev: number };
    const rows: Row[] = [
      ...goalRows.map((r) => ({ kind: 'goal' as const, ...r })),
      ...stepRows.map((r) => ({ kind: 'step' as const, ...r })),
    ].sort((a, b) => a.rev - b.rev);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      goals: page.filter((r) => r.kind === 'goal').map((r) => r.data as Goal),
      steps: page.filter((r) => r.kind === 'step').map((r) => r.data as Step),
      // Lower than `since` when the server's database was reset or restored
      // from an older backup; the device then re-sends everything it has.
      rev: hasMore ? page.at(-1)!.rev : this.rev,
      hasMore,
    };
  }

  /** Called with the new revision whenever something was stored. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.rev);
  }
}
