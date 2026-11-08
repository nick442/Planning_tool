import { create } from 'zustand';
import { uncompleteStep, type Step } from '@planning/shared';
import { showToast } from '@/components/toast';
import { commitSteps, getSteps } from '@/db/dataStore';
import { toggleComplete } from '@/features/tree/stepActions';

/** How long a completed step stays in the outline while it animates out. */
export const LEAVE_MS = 700;

interface LeavingState {
  /** Steps that were just completed and are animating out of the outline. */
  leaving: Record<string, true>;
}

export const useLeavingStore = create<LeavingState>(() => ({ leaving: {} }));

function markLeaving(ids: readonly string[]): void {
  if (ids.length === 0) return;
  useLeavingStore.setState((s) => ({
    leaving: { ...s.leaving, ...Object.fromEntries(ids.map((id) => [id, true as const])) },
  }));
  setTimeout(() => {
    useLeavingStore.setState((s) => {
      const leaving = { ...s.leaving };
      for (const id of ids) delete leaving[id];
      return { leaving };
    });
  }, LEAVE_MS);
}

/**
 * Undo a completion: reopens the step, whatever was completed in the same
 * action (cascade, or the child that finished it) and any parent that was
 * auto-completed because of it.
 */
export function undoCompletion(stepId: string): boolean {
  const step = getSteps().find((s) => s.id === stepId && !s.deleted);
  if (!step || step.status !== 'done') return false;
  commitSteps(uncompleteStep(getSteps(), stepId));
  return true;
}

/**
 * Completes (or reopens) a step from the outline, with the animation and an
 * undo toast. A finished branch gets a small celebration instead.
 * Resolves false if the user cancelled.
 */
export async function toggleWithFeedback(step: Step): Promise<boolean> {
  const result = await toggleComplete(step);
  if (!result) return false;
  if (result.kind === 'reopened') return true;

  const completed = result.changes.filter((c) => c.status === 'done');
  markLeaving(completed.map((c) => c.id));

  // Auto-completed ancestors come after the step, lowest first; name the highest.
  const branch = completed.filter((c) => c.autoCompleted).at(-1);
  const undo = { label: 'Undo', run: () => undoCompletion(step.id) };
  showToast(
    branch
      ? {
          message: `🎉 Branch finished: ${branch.title || 'Untitled'}`,
          tone: 'celebrate',
          action: undo,
        }
      : { message: `Done: ${step.title || 'Untitled'}`, action: undo, duration: 4000 },
  );
  return true;
}
