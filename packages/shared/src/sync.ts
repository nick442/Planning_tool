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

/**
 * Last write wins, per record: `incoming` replaces `existing` when it was
 * changed later. On a tie the existing copy stays, so every device and the
 * server settle on the same record.
 */
export function isNewer(
  incoming: { updatedAt: string },
  existing: { updatedAt: string } | undefined,
): boolean {
  if (!existing) return true;
  return Date.parse(incoming.updatedAt) > Date.parse(existing.updatedAt);
}
