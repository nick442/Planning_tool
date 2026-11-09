import { z } from 'zod';
import { goalSchema, stepSchema } from './schema';

/**
 * The JSON export file: every goal and step, deleted ones included, so an
 * export is a complete copy of the data.
 */
export const EXPORT_FORMAT = 'planning-tool-export';

export const exportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  goals: z.array(goalSchema),
  steps: z.array(stepSchema),
});

export type ExportFile = z.infer<typeof exportFileSchema>;
