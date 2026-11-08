import { resolveContext, type ContextInput, type MutationContext } from './context';
import { compareOrder, keyAt } from './order';
import type { Step } from './schema';

/**
 * Pure tree logic for steps.
 *
 * Steps are stored flat (`parentId` + fractional `order`) and the tree is built
 * in memory. Every mutation takes the current list of steps and returns only
 * the records it created or changed (each with a fresh `updatedAt`). The caller
 * writes those to the local database and the sync outbox. Use
 * {@link applyChanges} to fold them back into an in-memory list.
 *
 * Invariants kept by the mutations:
 * - A done step never has an open descendant: adding or moving open work under
 *   a done step reopens it (and its done ancestors).
 * - When the last open child of a step is completed, the step is
 *   auto-completed (`autoCompleted: true`), recursively up the tree.
 * - All steps completed by one action share the same `completedAt`, which is
 *   how {@link uncompleteStep} knows what to restore.
 * - Nothing is hard-deleted: deletion sets `deleted: true` on the whole branch.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type TreeErrorCode =
  'not-found' | 'cycle' | 'goal-mismatch' | 'not-a-sibling' | 'open-descendants';

export class TreeError extends Error {
  readonly code: TreeErrorCode;

  constructor(code: TreeErrorCode, message: string) {
    super(message);
    this.name = 'TreeError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

/**
 * Where to put a step among its (new) siblings. Omitted = at the end.
 *
 * - `{ index }`: position among all non-deleted siblings (completed ones
 *   included), not counting the step being moved.
 * - `{ afterId }`: directly after that sibling; `null` = at the start.
 * - `{ beforeId }`: directly before that sibling; `null` = at the end.
 *
 * Prefer `afterId` / `beforeId` from the UI: they stay correct when completed
 * steps are hidden.
 */
export type Position = { index: number } | { afterId: string | null } | { beforeId: string | null };

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

const rootKey = (goalId: string) => `goal:${goalId}`;
const parentKeyOf = (step: Pick<Step, 'goalId' | 'parentId'>) =>
  step.parentId ?? rootKey(step.goalId);

/** Lookup structures over the non-deleted steps. */
class StepIndex {
  private readonly byId = new Map<string, Step>();
  private childIndex: Map<string, string[]> | null = null;

  constructor(steps: Iterable<Step>) {
    for (const step of steps) this.byId.set(step.id, step);
  }

  /** A non-deleted step, or undefined. */
  get(id: string): Step | undefined {
    const step = this.byId.get(id);
    return step && !step.deleted ? step : undefined;
  }

  require(id: string): Step {
    const step = this.get(id);
    if (!step) throw new TreeError('not-found', `Step ${id} not found`);
    return step;
  }

  set(step: Step, structural: boolean): void {
    this.byId.set(step.id, step);
    if (structural) this.childIndex = null;
  }

  all(): IterableIterator<Step> {
    return this.byId.values();
  }

  /**
   * Non-deleted children under a parent key, sorted by order. The cached index
   * stores ids (it only changes on structural edits); records are resolved on
   * access so non-structural edits are always visible.
   */
  childrenByKey(key: string): Step[] {
    if (!this.childIndex) {
      const index = new Map<string, Step[]>();
      for (const step of this.byId.values()) {
        if (step.deleted) continue;
        const key = parentKeyOf(step);
        const list = index.get(key);
        if (list) list.push(step);
        else index.set(key, [step]);
      }
      this.childIndex = new Map(
        [...index].map(([key, list]) => [key, list.sort(compareOrder).map((s) => s.id)]),
      );
    }
    return (this.childIndex.get(key) ?? []).map((id) => this.byId.get(id)!);
  }

  children(stepId: string): readonly Step[] {
    return this.childrenByKey(stepId);
  }

  roots(goalId: string): readonly Step[] {
    return this.childrenByKey(rootKey(goalId));
  }

  /** Siblings of a step (including the step itself). */
  siblings(step: Step): readonly Step[] {
    return this.childrenByKey(parentKeyOf(step));
  }

  /** All non-deleted descendants, depth-first in display order. */
  descendants(stepId: string): Step[] {
    const out: Step[] = [];
    const visit = (id: string) => {
      for (const child of this.children(id)) {
        out.push(child);
        visit(child.id);
      }
    };
    visit(stepId);
    return out;
  }

  /** Ancestors from the top-level step down to the direct parent. */
  ancestors(step: Step): Step[] {
    const out: Step[] = [];
    const seen = new Set<string>([step.id]);
    let parentId = step.parentId;
    while (parentId !== null && !seen.has(parentId)) {
      const parent = this.get(parentId);
      if (!parent) break;
      out.unshift(parent);
      seen.add(parent.id);
      parentId = parent.parentId;
    }
    return out;
  }

  isDescendant(candidateId: string, ancestorId: string): boolean {
    let current = this.get(candidateId);
    const seen = new Set<string>();
    while (current && current.parentId !== null && !seen.has(current.id)) {
      if (current.parentId === ancestorId) return true;
      seen.add(current.id);
      current = this.get(current.parentId);
    }
    return false;
  }
}

export interface Progress {
  /** Done leaf steps. */
  done: number;
  /** All leaf steps. */
  total: number;
  /** done / total, or 0 when there are no leaves. */
  ratio: number;
}

const progressOf = (done: number, total: number): Progress => ({
  done,
  total,
  ratio: total === 0 ? 0 : done / total,
});

function computeProgress(index: StepIndex, step: Step): Progress {
  const children = index.children(step.id);
  if (children.length === 0) return progressOf(step.status === 'done' ? 1 : 0, 1);
  let done = 0;
  let total = 0;
  for (const child of children) {
    const p = computeProgress(index, child);
    done += p.done;
    total += p.total;
  }
  return progressOf(done, total);
}

export interface TreeNode {
  step: Step;
  /** Visible children (completed ones are left out unless requested). */
  children: TreeNode[];
  /** Leaf progress of this branch, always counting completed steps. */
  progress: Progress;
  /** True when the step has no non-deleted children at all (even hidden ones). */
  isLeaf: boolean;
  /** Depth below the goal; top-level steps are 0. */
  depth: number;
}

export interface BuildTreeOptions {
  /** Include done steps in `children`. Default false (they live in the Completed feed). */
  includeCompleted?: boolean;
}

/**
 * Builds the visible tree for a goal. Progress always counts every leaf,
 * including the hidden completed ones.
 */
export function buildTree(
  steps: readonly Step[],
  goalId: string,
  options: BuildTreeOptions = {},
): TreeNode[] {
  const index = new StepIndex(steps);
  const includeCompleted = options.includeCompleted ?? false;

  const build = (step: Step, depth: number): TreeNode => {
    const allChildren = index.children(step.id);
    const children = allChildren
      .filter((child) => includeCompleted || child.status !== 'done')
      .map((child) => build(child, depth + 1));
    return {
      step,
      children,
      progress: computeProgress(index, step),
      isLeaf: allChildren.length === 0,
      depth,
    };
  };

  return index
    .roots(goalId)
    .filter((step) => includeCompleted || step.status !== 'done')
    .map((step) => build(step, 0));
}

/** Flattens a tree into display order (pre-order), e.g. for keyboard navigation. */
export function flattenTree(nodes: readonly TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const visit = (list: readonly TreeNode[]) => {
    for (const node of list) {
      out.push(node);
      visit(node.children);
    }
  };
  visit(nodes);
  return out;
}

/** Leaf progress of a whole goal. A goal without steps has 0 / 0. */
export function goalProgress(steps: readonly Step[], goalId: string): Progress {
  const index = new StepIndex(steps);
  let done = 0;
  let total = 0;
  for (const root of index.roots(goalId)) {
    const p = computeProgress(index, root);
    done += p.done;
    total += p.total;
  }
  return progressOf(done, total);
}

/** Leaf progress of one branch. */
export function stepProgress(steps: readonly Step[], stepId: string): Progress {
  const index = new StepIndex(steps);
  return computeProgress(index, index.require(stepId));
}

/** Non-deleted children of a step (or of the goal when `parentId` is null), sorted. */
export function getChildren(
  steps: readonly Step[],
  goalId: string,
  parentId: string | null,
): Step[] {
  const index = new StepIndex(steps);
  return [...(parentId === null ? index.roots(goalId) : index.children(parentId))];
}

/** Ancestors from the top-level step down to the direct parent (the breadcrumb). */
export function getAncestors(steps: readonly Step[], stepId: string): Step[] {
  const index = new StepIndex(steps);
  return index.ancestors(index.require(stepId));
}

/** All non-deleted descendants of a step in display order. */
export function getDescendants(steps: readonly Step[], stepId: string): Step[] {
  const index = new StepIndex(steps);
  index.require(stepId);
  return index.descendants(stepId);
}

/**
 * Number of open descendants. When this is > 0, ask
 * "Mark all N remaining steps done?" before calling
 * `completeStep(..., { cascade: true })`.
 */
export function countOpenDescendants(steps: readonly Step[], stepId: string): number {
  return getDescendants(steps, stepId).filter((s) => s.status === 'open').length;
}

/** Replaces changed records by id and appends new ones. Returns a new array. */
export function applyChanges<T extends { id: string }>(
  records: readonly T[],
  changes: readonly T[],
): T[] {
  if (changes.length === 0) return [...records];
  const byId = new Map(changes.map((c) => [c.id, c]));
  const out = records.map((r) => {
    const changed = byId.get(r.id);
    if (!changed) return r;
    byId.delete(r.id);
    return changed;
  });
  out.push(...byId.values());
  return out;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const STRUCTURAL_KEYS: ReadonlySet<keyof Step> = new Set([
  'parentId',
  'goalId',
  'order',
  'deleted',
]);

type StepPatch = Partial<Omit<Step, 'id'>>;
/** Optional fields a mutation may clear. */
type RemovableKey = 'completedAt' | 'autoCompleted';

/** A working copy that records every record it touches. */
class Draft {
  readonly index: StepIndex;
  readonly ctx: MutationContext;
  private readonly changed = new Map<string, Step>();

  constructor(steps: readonly Step[], ctx: ContextInput | undefined) {
    this.index = new StepIndex(steps);
    this.ctx = resolveContext(ctx);
  }

  insert(step: Step): void {
    this.index.set(step, true);
    this.changed.set(step.id, step);
  }

  update(id: string, patch: StepPatch, remove: readonly RemovableKey[] = []): Step {
    const current = this.index.require(id);
    const next: Step = { ...current, ...patch, updatedAt: this.ctx.now };
    for (const key of remove) delete next[key];
    const structural = Object.keys(patch).some((k) => STRUCTURAL_KEYS.has(k as keyof Step));
    this.index.set(next, structural);
    this.changed.set(id, next);
    return next;
  }

  changes(): Step[] {
    return [...this.changed.values()];
  }

  // -- completion helpers ---------------------------------------------------

  complete(id: string, auto: boolean): void {
    this.update(
      id,
      auto
        ? { status: 'done', completedAt: this.ctx.now, autoCompleted: true }
        : { status: 'done', completedAt: this.ctx.now },
      auto ? [] : ['autoCompleted'],
    );
  }

  reopen(id: string): void {
    this.update(id, { status: 'open' }, ['completedAt', 'autoCompleted']);
  }

  /** Reopens every done ancestor of `step` (open work now lives below them). */
  reopenAncestors(step: Step): void {
    for (const ancestor of this.index.ancestors(step)) {
      if (ancestor.status === 'done') this.reopen(ancestor.id);
    }
  }

  /**
   * Starting at `parentId`, auto-completes each open step whose children are
   * all done, walking up until a step still has open work.
   */
  autoCompleteFrom(parentId: string | null): void {
    const seen = new Set<string>();
    let current = parentId === null ? undefined : this.index.get(parentId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.status === 'done') break;
      const children = this.index.children(current.id);
      if (children.length === 0 || children.some((c) => c.status !== 'done')) break;
      this.complete(current.id, true);
      current = current.parentId === null ? undefined : this.index.get(current.parentId);
    }
  }

  hasOpenWork(step: Step): boolean {
    return (
      step.status === 'open' || this.index.descendants(step.id).some((d) => d.status === 'open')
    );
  }

  // -- positioning ----------------------------------------------------------

  /** Order key for `position` among `siblings` (which must exclude the moving step). */
  orderFor(siblings: readonly Step[], position: Position | undefined): string {
    const keys = siblings.map((s) => s.order);
    if (!position) return keyAt(keys, keys.length);
    if ('index' in position) return keyAt(keys, position.index);
    if ('afterId' in position) {
      if (position.afterId === null) return keyAt(keys, 0);
      return keyAt(keys, this.siblingIndex(siblings, position.afterId) + 1);
    }
    if (position.beforeId === null) return keyAt(keys, keys.length);
    return keyAt(keys, this.siblingIndex(siblings, position.beforeId));
  }

  private siblingIndex(siblings: readonly Step[], id: string): number {
    const i = siblings.findIndex((s) => s.id === id);
    if (i === -1) throw new TreeError('not-a-sibling', `Step ${id} is not a sibling here`);
    return i;
  }
}

export interface AddStepInput {
  goalId: string;
  /** null / omitted = top-level step under the goal. */
  parentId?: string | null;
  title?: string;
  notes?: string;
  /** Omitted = at the end of the siblings. */
  position?: Position;
}

export interface AddStepResult {
  step: Step;
  /** The new step plus any ancestors that were reopened. */
  changes: Step[];
}

/**
 * Adds a new open step. `Enter` on a row → `{ parentId: row.parentId, position: { afterId: row.id } }`;
 * the "+" on a row → `{ parentId: row.id }`.
 */
export function addStep(
  steps: readonly Step[],
  input: AddStepInput,
  ctx?: ContextInput,
): AddStepResult {
  const draft = new Draft(steps, ctx);
  const parentId = input.parentId ?? null;
  if (parentId !== null) {
    const parent = draft.index.require(parentId);
    if (parent.goalId !== input.goalId) {
      throw new TreeError('goal-mismatch', `Parent ${parentId} belongs to another goal`);
    }
  }
  const siblings =
    parentId === null ? draft.index.roots(input.goalId) : draft.index.children(parentId);

  const step: Step = {
    id: draft.ctx.newId(),
    goalId: input.goalId,
    parentId,
    order: draft.orderFor(siblings, input.position),
    title: input.title ?? '',
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    status: 'open',
    createdAt: draft.ctx.now,
    updatedAt: draft.ctx.now,
    deleted: false,
  };
  draft.insert(step);
  draft.reopenAncestors(step);
  return { step, changes: draft.changes() };
}

export type StepEdit = Partial<Pick<Step, 'title' | 'notes' | 'size' | 'inToday'>>;

/** Edits plain fields (title, notes, size, inToday). */
export function updateStep(
  steps: readonly Step[],
  stepId: string,
  edit: StepEdit,
  ctx?: ContextInput,
): Step[] {
  const draft = new Draft(steps, ctx);
  draft.index.require(stepId);
  draft.update(stepId, edit);
  return draft.changes();
}

export interface MoveTarget {
  /** New parent step, or null for top level. */
  parentId: string | null;
  /**
   * Goal to move into. Only needed when `parentId` is null and the step moves
   * to another goal; otherwise it is taken from the parent (or the step).
   */
  goalId?: string;
  position?: Position;
}

/**
 * Moves a step (with its whole branch) to a new parent and/or position.
 * Moving into the step's own branch throws a `cycle` error.
 */
export function moveStep(
  steps: readonly Step[],
  stepId: string,
  target: MoveTarget,
  ctx?: ContextInput,
): Step[] {
  const draft = new Draft(steps, ctx);
  moveInDraft(draft, stepId, target);
  return draft.changes();
}

function moveInDraft(draft: Draft, stepId: string, target: MoveTarget): void {
  const { index } = draft;
  const step = index.require(stepId);

  let goalId: string;
  if (target.parentId !== null) {
    if (target.parentId === stepId || index.isDescendant(target.parentId, stepId)) {
      throw new TreeError('cycle', 'A step cannot be moved into its own branch');
    }
    const parent = index.require(target.parentId);
    if (target.goalId !== undefined && target.goalId !== parent.goalId) {
      throw new TreeError('goal-mismatch', `Parent ${parent.id} belongs to another goal`);
    }
    goalId = parent.goalId;
  } else {
    goalId = target.goalId ?? step.goalId;
  }

  const siblings = (
    target.parentId === null ? index.roots(goalId) : index.children(target.parentId)
  ).filter((s) => s.id !== stepId);
  const order = draft.orderFor(siblings, target.position);

  const oldParentId = step.parentId;
  const descendants = goalId !== step.goalId ? index.descendants(stepId) : [];
  const moved = draft.update(stepId, { parentId: target.parentId, goalId, order });
  for (const d of descendants) draft.update(d.id, { goalId });

  if (draft.hasOpenWork(moved)) draft.reopenAncestors(moved);
  if (oldParentId !== target.parentId) draft.autoCompleteFrom(oldParentId);
}

export interface IndentOptions {
  /**
   * Whether completed siblings count as "the step above". Should match what
   * the outline shows. Default false.
   */
  includeCompleted?: boolean;
}

/**
 * `Tab`: makes the step the last child of the sibling above it. Returns no
 * changes when there is no sibling above.
 */
export function indentStep(
  steps: readonly Step[],
  stepId: string,
  options: IndentOptions = {},
  ctx?: ContextInput,
): Step[] {
  const draft = new Draft(steps, ctx);
  const step = draft.index.require(stepId);
  const visible = draft.index
    .siblings(step)
    .filter((s) => s.id === stepId || options.includeCompleted || s.status !== 'done');
  const i = visible.findIndex((s) => s.id === stepId);
  const above = visible[i - 1];
  if (!above) return [];
  moveInDraft(draft, stepId, { parentId: above.id });
  return draft.changes();
}

/**
 * `Shift+Tab`: makes the step a sibling of its parent, directly below it.
 * Returns no changes for top-level steps.
 */
export function outdentStep(steps: readonly Step[], stepId: string, ctx?: ContextInput): Step[] {
  const draft = new Draft(steps, ctx);
  const step = draft.index.require(stepId);
  if (step.parentId === null) return [];
  const parent = draft.index.require(step.parentId);
  moveInDraft(draft, stepId, {
    parentId: parent.parentId,
    goalId: parent.goalId,
    position: { afterId: parent.id },
  });
  return draft.changes();
}

export interface CompleteOptions {
  /**
   * Also complete every open descendant. Without it, completing a step that
   * still has open descendants throws an `open-descendants` error; check
   * {@link countOpenDescendants} first and ask the user.
   */
  cascade?: boolean;
}

/**
 * Marks a step done. If that finishes the last open child of its parent, the
 * parent is auto-completed too (recursively). Completing a done step is a no-op.
 *
 * To show the "Branch finished!" moment, look for changes with
 * `autoCompleted: true`.
 */
export function completeStep(
  steps: readonly Step[],
  stepId: string,
  options: CompleteOptions = {},
  ctx?: ContextInput,
): Step[] {
  const draft = new Draft(steps, ctx);
  const step = draft.index.require(stepId);
  if (step.status === 'done') return [];

  const openDescendants = draft.index.descendants(stepId).filter((d) => d.status === 'open');
  if (openDescendants.length > 0 && !options.cascade) {
    throw new TreeError(
      'open-descendants',
      `Step ${stepId} has ${openDescendants.length} open descendant(s)`,
    );
  }
  for (const d of openDescendants) draft.complete(d.id, false);
  draft.complete(stepId, false);
  draft.autoCompleteFrom(step.parentId);
  return draft.changes();
}

/**
 * Undo for a completed step (e.g. the undo button in the Completed feed):
 * - reopens the step;
 * - reopens descendants completed in the same action (same `completedAt`):
 *   the cascade, or the child whose completion auto-completed this step;
 * - reopens done ancestors, since they now contain open work. This restores
 *   parents that were auto-completed by this step.
 *
 * Uncompleting an open step is a no-op.
 */
export function uncompleteStep(steps: readonly Step[], stepId: string, ctx?: ContextInput): Step[] {
  const draft = new Draft(steps, ctx);
  const step = draft.index.require(stepId);
  if (step.status !== 'done') return [];

  const batch = step.completedAt;
  draft.reopen(stepId);
  if (batch !== undefined) {
    for (const d of draft.index.descendants(stepId)) {
      if (d.status === 'done' && d.completedAt === batch) draft.reopen(d.id);
    }
  }
  draft.reopenAncestors(step);
  return draft.changes();
}

/**
 * Soft-deletes a step and its whole branch. If that leaves the parent with
 * only done children, the parent is auto-completed.
 */
export function deleteStep(steps: readonly Step[], stepId: string, ctx?: ContextInput): Step[] {
  const draft = new Draft(steps, ctx);
  const step = draft.index.require(stepId);
  const branch = [step, ...draft.index.descendants(stepId)];
  for (const s of branch) draft.update(s.id, { deleted: true });
  draft.autoCompleteFrom(step.parentId);
  return draft.changes();
}
