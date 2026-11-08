import {
  addStep,
  completeStep,
  countOpenDescendants,
  deleteStep,
  getDescendants,
  indentStep,
  moveStep,
  outdentStep,
  uncompleteStep,
  updateStep,
  type MoveTarget,
  type Step,
} from '@planning/shared';
import { confirm } from '@/components/confirm';
import { commitSteps, getSteps } from '@/db/dataStore';

/**
 * Outline commands: thin wrappers that run the pure tree functions from
 * `@planning/shared` against the in-memory steps and commit the result.
 * They are synchronous except where they ask the user something.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const live = (id: string) => getSteps().find((s) => s.id === id && !s.deleted);

/** Adds a step and returns its id. */
export function addStepAt(
  goalId: string,
  parentId: string | null,
  position?: { afterId: string | null },
  title = '',
): string {
  const { step, changes } = addStep(getSteps(), {
    goalId,
    parentId,
    title,
    ...(position ? { position } : {}),
  });
  commitSteps(changes);
  return step.id;
}

/** `Enter`: a new empty sibling directly below `step`. */
export function addSiblingBelow(step: Step): string {
  return addStepAt(step.goalId, step.parentId, { afterId: step.id });
}

/** "+" on a row: a new empty child at the end of `step`'s children. */
export function addChild(step: Step): string {
  return addStepAt(step.goalId, step.id);
}

export function renameStep(step: Step, title: string): void {
  const current = live(step.id);
  if (!current || current.title === title) return;
  commitSteps(updateStep(getSteps(), step.id, { title }));
}

export function setNotes(step: Step, notes: string): void {
  if (!live(step.id)) return;
  commitSteps(updateStep(getSteps(), step.id, { notes }));
}

export function indent(step: Step, includeCompleted: boolean): void {
  if (!live(step.id)) return;
  commitSteps(indentStep(getSteps(), step.id, { includeCompleted }));
}

export function outdent(step: Step): void {
  if (!live(step.id)) return;
  commitSteps(outdentStep(getSteps(), step.id));
}

export function move(step: Step, target: MoveTarget): void {
  if (!live(step.id)) return;
  commitSteps(moveStep(getSteps(), step.id, target));
}

/**
 * Completes a step, or reopens it if it is already done. Asks before
 * completing a step that still has open sub-steps. Resolves false if cancelled.
 */
export async function toggleComplete(step: Step): Promise<boolean> {
  const current = live(step.id);
  if (!current) return false;

  if (current.status === 'done') {
    commitSteps(uncompleteStep(getSteps(), step.id));
    return true;
  }
  const open = countOpenDescendants(getSteps(), step.id);
  if (open > 0) {
    const ok = await confirm({
      title: `Mark all ${plural(open, 'remaining step')} done?`,
      description: `"${current.title || 'Untitled'}" still has open sub-steps.`,
      confirmLabel: 'Mark all done',
    });
    if (!ok || !live(step.id)) return false;
  }
  commitSteps(completeStep(getSteps(), step.id, { cascade: true }));
  return true;
}

/** Deletes a step, asking first if it has sub-steps. Resolves false if cancelled. */
export async function removeStep(step: Step, { ask = true } = {}): Promise<boolean> {
  if (!live(step.id)) return false;
  const descendants = getDescendants(getSteps(), step.id).length;
  if (ask && descendants > 0) {
    const ok = await confirm({
      title: `Delete "${step.title || 'Untitled'}"?`,
      description: `This also deletes its ${plural(descendants, 'sub-step')}.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok || !live(step.id)) return false;
  }
  commitSteps(deleteStep(getSteps(), step.id));
  return true;
}
