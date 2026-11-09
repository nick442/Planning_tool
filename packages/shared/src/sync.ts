import { z } from 'zod';
import { goalSchema, stepSchema, type Goal, type Step } from './schema';

/**
 * The sync protocol between the devices and the Mac mini. See PLAN.md §5.
 *
 * - POST /api/sync/push  { goals, steps } → { accepted, rev }
 * - GET  /api/sync/pull?since=<rev>      → { goals, steps, rev, hasMore }
 * - GET  /api/sync/events                → SSE "changed" events with the new rev
 */

/** Records pushed by a device. `rev` is the server's business, so it is ignored. */
export const pushRequestSchema = z.object({
  goals: z.array(goalSchema).max(5000).default([]),
  steps: z.array(stepSchema).max(5000).default([]),
});

export type PushRequest = z.input<typeof pushRequestSchema>;

export interface PushResponse {
  /** Ids the server stored. Others were older than the server's copy. */
  accepted: string[];
  /** The server's latest revision after this push. */
  rev: number;
}

export interface PullResponse {
  /**
   * Identifies the server's database. It changes when the database is
   * replaced (fresh start, restored backup); devices then send everything
   * they have and pull from scratch.
   */
  epoch: string;
  goals: Goal[];
  steps: Step[];
  /** Pass this as `since` next time. */
  rev: number;
  /** More changes are waiting: pull again with the returned `rev`. */
  hasMore: boolean;
}

export interface ChangedEvent {
  rev: number;
}

// Kept in its own zod-free module so the web bundle can use it cheaply.
export { isNewer } from './lww';
