import { z } from 'zod';

/**
 * Zod schemas for the records that live on every device (IndexedDB) and on the
 * Mac mini (SQLite). The same schemas validate data on both sides of sync.
 */

const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();

/** Fields every synced record carries. See PLAN.md §5 "Sync protocol". */
export const syncFieldsSchema = z.object({
  /** ULID generated on the device, so records can be created offline. */
  id: z.string().min(1),
  /** When the record was last changed, set on the device. Used for last-write-wins. */
  updatedAt: isoDateTime,
  /** Soft-delete marker, so deletions sync too. */
  deleted: z.boolean(),
  /** Revision number assigned by the server; absent until the server has stored it. */
  rev: z.number().int().nonnegative().optional(),
});

export const goalKindSchema = z.enum(['course', 'thesis', 'exam', 'other']);

export const goalSchema = syncFieldsSchema.extend({
  title: z.string(),
  kind: goalKindSchema,
  /** e.g. "Advanced ML". */
  course: z.string().optional(),
  /** Accent colour (any CSS colour) or an emoji. */
  color: z.string(),
  /** ISO date (YYYY-MM-DD). Display and countdown only. */
  deadline: isoDate.optional(),
  /** Fractional index: drag-and-drop order in the sidebar. */
  order: z.string().min(1),
  archived: z.boolean(),
  createdAt: isoDateTime,
});

export const stepSizeSchema = z.enum(['S', 'M', 'L']);
export const stepStatusSchema = z.enum(['open', 'done']);

export const stepSchema = syncFieldsSchema.extend({
  goalId: z.string().min(1),
  /** null = top-level step directly under the goal. */
  parentId: z.string().min(1).nullable(),
  /** Fractional index among siblings. */
  order: z.string().min(1),
  title: z.string(),
  notes: z.string().optional(),
  /** v2: rough size, used for the "Too big?" nudge. */
  size: stepSizeSchema.optional(),
  status: stepStatusSchema,
  completedAt: isoDateTime.optional(),
  /** True when the step was completed because all of its children finished. */
  autoCompleted: z.boolean().optional(),
  /** v2: picked for the Today / Focus list. */
  inToday: z.boolean().optional(),
  createdAt: isoDateTime,
});

export type SyncFields = z.infer<typeof syncFieldsSchema>;
export type GoalKind = z.infer<typeof goalKindSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type StepSize = z.infer<typeof stepSizeSchema>;
export type StepStatus = z.infer<typeof stepStatusSchema>;
export type Step = z.infer<typeof stepSchema>;
