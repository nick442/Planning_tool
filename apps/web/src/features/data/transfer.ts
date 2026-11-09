import { isNewer, type Goal, type Step } from '@planning/shared';
import type { ExportFile } from '@planning/shared/export';
import { commitGoals, commitSteps, getGoals, getSteps } from '@/db/dataStore';

/** A complete copy of the data (deleted records included). */
export function buildExport(
  goals: readonly Goal[],
  steps: readonly Step[],
  now = new Date(),
): ExportFile {
  return {
    format: 'planning-tool-export',
    version: 1,
    exportedAt: now.toISOString(),
    goals: [...goals],
    steps: [...steps],
  };
}

export function exportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `planning-export-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Saves the export as a file through the browser's download. */
export function downloadExport(): void {
  const data = buildExport(getGoals(), getSteps());
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class ImportError extends Error {}

export interface ImportPlan {
  goals: Goal[];
  steps: Step[];
  added: number;
  updated: number;
  /** Records the device already has in the same or a newer version. */
  unchanged: number;
}

/**
 * Checks an export file and works out what to apply. Records merge by last
 * write wins, so importing an old export never overwrites newer work.
 */
export async function planImport(
  text: string,
  current: { goals: readonly Goal[]; steps: readonly Step[] },
): Promise<ImportPlan> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError("This file isn't JSON.");
  }
  // The validator is only downloaded when someone imports.
  const { exportFileSchema } = await import('@planning/shared/export');
  const parsed = exportFileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (at ${issue.path.join('.')})` : '';
    throw new ImportError(`This isn't a Planning Tool export${where}: ${issue?.message ?? ''}`);
  }

  const plan: ImportPlan = { goals: [], steps: [], added: 0, updated: 0, unchanged: 0 };
  const merge = <T extends { id: string; updatedAt: string }>(
    incoming: T[],
    existing: readonly T[],
    into: T[],
  ) => {
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (const record of incoming) {
      const mine = byId.get(record.id);
      if (!isNewer(record, mine)) plan.unchanged++;
      else {
        if (mine) plan.updated++;
        else plan.added++;
        into.push(record);
      }
    }
  };
  merge(parsed.data.goals, current.goals, plan.goals);
  merge(parsed.data.steps, current.steps, plan.steps);
  return plan;
}

/** Imports an export file into this device; the changes then sync like any edit. */
export async function importFile(file: Blob): Promise<ImportPlan> {
  const plan = await planImport(await file.text(), { goals: getGoals(), steps: getSteps() });
  commitGoals(plan.goals);
  commitSteps(plan.steps);
  return plan;
}
