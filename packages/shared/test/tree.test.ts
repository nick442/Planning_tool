import { describe, expect, it } from 'vitest';
import { stepSchema, type Step } from '../src/schema';
import {
  addStep,
  applyChanges,
  buildTree,
  completeStep,
  countOpenDescendants,
  deleteStep,
  flattenTree,
  getAncestors,
  getChildren,
  getDescendants,
  goalProgress,
  indentStep,
  moveStep,
  outdentStep,
  stepProgress,
  TreeError,
  uncompleteStep,
  updateStep,
} from '../src/tree';
import { byId, dedent, frozen, idGen, makeStep, outline, render, T0, T1, T2 } from './helpers';

const thesis = () =>
  frozen(
    outline(
      'g1',
      `
      Lit review
        Find sources
          Search Scopus [x]
          Ask supervisor
        Write summaries
          Paper A [x]
          Paper B
      Methodology
        Draft RQs
      `,
    ),
  );

/** Applies a mutation and returns the new full list. */
const apply = (steps: readonly Step[], changes: Step[]) => applyChanges(steps, changes);

function expectTreeError(fn: () => unknown, code: TreeError['code']) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(TreeError);
    expect((err as TreeError).code).toBe(code);
    return;
  }
  throw new Error(`expected TreeError ${code}`);
}

describe('buildTree', () => {
  it('builds the nested tree in order and hides completed steps by default', () => {
    const tree = buildTree(thesis(), 'g1');
    expect(flattenTree(tree).map((n) => `${'  '.repeat(n.depth)}${n.step.title}`)).toEqual([
      'Lit review',
      '  Find sources',
      '    Ask supervisor',
      '  Write summaries',
      '    Paper B',
      'Methodology',
      '  Draft RQs',
    ]);
  });

  it('includes completed steps on request', () => {
    expect(render(thesis(), 'g1')).toBe(
      dedent(`
        Lit review
          Find sources
            Search Scopus [x]
            Ask supervisor
          Write summaries
            Paper A [x]
            Paper B
        Methodology
          Draft RQs
      `),
    );
  });

  it('counts hidden completed leaves in progress', () => {
    const [litReview, methodology] = buildTree(thesis(), 'g1');
    expect(litReview!.progress).toEqual({ done: 2, total: 4, ratio: 0.5 });
    expect(litReview!.children[0]!.progress).toEqual({ done: 1, total: 2, ratio: 0.5 });
    expect(methodology!.progress).toEqual({ done: 0, total: 1, ratio: 0 });
  });

  it('marks leaves by their full children, not the visible ones', () => {
    const steps = outline(
      'g1',
      `
      Parent
        Child [x]
        Other
      `,
    );
    const [parent] = buildTree(steps, 'g1');
    expect(parent!.isLeaf).toBe(false);
    expect(parent!.children.map((c) => c.step.id)).toEqual(['Other']);
    expect(parent!.children[0]!.isLeaf).toBe(true);
  });

  it('ignores deleted steps, other goals and orphans', () => {
    const steps = [
      ...outline('g1', 'A\nB'),
      makeStep({ id: 'gone', order: 'a5', deleted: true }),
      makeStep({ id: 'other-goal', goalId: 'g2' }),
      makeStep({ id: 'orphan', parentId: 'missing' }),
    ];
    expect(render(steps, 'g1')).toBe('A\nB');
  });

  it('sorts siblings with equal order keys by id', () => {
    const steps = [
      makeStep({ id: 'b', order: 'a1' }),
      makeStep({ id: 'a', order: 'a1' }),
      makeStep({ id: 'z', order: 'a0' }),
    ];
    expect(buildTree(steps, 'g1').map((n) => n.step.id)).toEqual(['z', 'a', 'b']);
  });
});

describe('read helpers', () => {
  it('goalProgress counts leaves across the whole goal', () => {
    expect(goalProgress(thesis(), 'g1')).toEqual({ done: 2, total: 5, ratio: 0.4 });
    expect(goalProgress(thesis(), 'empty')).toEqual({ done: 0, total: 0, ratio: 0 });
  });

  it('stepProgress for a leaf is 0/1 or 1/1', () => {
    expect(stepProgress(thesis(), 'Search Scopus')).toEqual({ done: 1, total: 1, ratio: 1 });
    expect(stepProgress(thesis(), 'Draft RQs')).toEqual({ done: 0, total: 1, ratio: 0 });
  });

  it('getChildren, getAncestors, getDescendants', () => {
    const steps = thesis();
    expect(getChildren(steps, 'g1', null).map((s) => s.id)).toEqual(['Lit review', 'Methodology']);
    expect(getChildren(steps, 'g1', 'Find sources').map((s) => s.id)).toEqual([
      'Search Scopus',
      'Ask supervisor',
    ]);
    expect(getAncestors(steps, 'Paper B').map((s) => s.id)).toEqual([
      'Lit review',
      'Write summaries',
    ]);
    expect(getAncestors(steps, 'Lit review')).toEqual([]);
    expect(getDescendants(steps, 'Lit review').map((s) => s.id)).toEqual([
      'Find sources',
      'Search Scopus',
      'Ask supervisor',
      'Write summaries',
      'Paper A',
      'Paper B',
    ]);
  });

  it('countOpenDescendants', () => {
    expect(countOpenDescendants(thesis(), 'Lit review')).toBe(4);
    expect(countOpenDescendants(thesis(), 'Draft RQs')).toBe(0);
  });

  it('throws not-found for unknown or deleted steps', () => {
    expectTreeError(() => stepProgress(thesis(), 'nope'), 'not-found');
    const steps = [makeStep({ id: 'x', deleted: true })];
    expectTreeError(() => getAncestors(steps, 'x'), 'not-found');
  });
});

describe('applyChanges', () => {
  it('replaces by id and appends new records without mutating the input', () => {
    const steps = frozen([makeStep({ id: 'a' }), makeStep({ id: 'b' })]);
    const out = applyChanges(steps, [makeStep({ id: 'b', title: 'B2' }), makeStep({ id: 'c' })]);
    expect(out.map((s) => `${s.id}:${s.title}`)).toEqual(['a:a', 'b:B2', 'c:c']);
    expect(steps).toHaveLength(2);
  });
});

describe('addStep', () => {
  const ctx = { now: T1, newId: idGen() };

  it('appends a valid top-level step by default', () => {
    const steps = thesis();
    const { step, changes } = addStep(steps, { goalId: 'g1', title: 'Write-up' }, ctx);
    expect(changes).toEqual([step]);
    expect(stepSchema.parse(step)).toEqual(step);
    expect(step).toMatchObject({
      id: 'new-1',
      goalId: 'g1',
      parentId: null,
      status: 'open',
      createdAt: T1,
      updatedAt: T1,
      deleted: false,
    });
    expect(getChildren(apply(steps, changes), 'g1', null).map((s) => s.title)).toEqual([
      'Lit review',
      'Methodology',
      'Write-up',
    ]);
  });

  it('inserts directly after a sibling (Enter) and at the start', () => {
    let steps: Step[] = [...thesis()];
    steps = apply(
      steps,
      addStep(
        steps,
        {
          goalId: 'g1',
          parentId: 'Find sources',
          title: 'Mid',
          position: { afterId: 'Search Scopus' },
        },
        { newId: () => 'Mid' },
      ).changes,
    );
    steps = apply(
      steps,
      addStep(
        steps,
        { goalId: 'g1', parentId: 'Find sources', title: 'First', position: { afterId: null } },
        { newId: () => 'First' },
      ).changes,
    );
    steps = apply(
      steps,
      addStep(
        steps,
        {
          goalId: 'g1',
          parentId: 'Find sources',
          title: 'Before last',
          position: { beforeId: 'Ask supervisor' },
        },
        { newId: () => 'Before last' },
      ).changes,
    );
    expect(getChildren(steps, 'g1', 'Find sources').map((s) => s.id)).toEqual([
      'First',
      'Search Scopus',
      'Mid',
      'Before last',
      'Ask supervisor',
    ]);
  });

  it('adds a child to a leaf (the "+" button), turning it into a branch', () => {
    const steps = thesis();
    const { step, changes } = addStep(steps, { goalId: 'g1', parentId: 'Draft RQs', title: 'RQ1' });
    const after = apply(steps, changes);
    expect(step.parentId).toBe('Draft RQs');
    expect(buildTree(after, 'g1')[1]!.children[0]!.isLeaf).toBe(false);
  });

  it('places a step by index among all siblings', () => {
    const steps = thesis();
    const { changes } = addStep(
      steps,
      { goalId: 'g1', parentId: 'Find sources', position: { index: 1 } },
      { newId: () => 'X' },
    );
    expect(getChildren(apply(steps, changes), 'g1', 'Find sources').map((s) => s.id)).toEqual([
      'Search Scopus',
      'X',
      'Ask supervisor',
    ]);
  });

  it('reopens done ancestors when adding open work beneath them', () => {
    const steps = frozen(
      outline(
        'g1',
        `
        Root [x auto]
          Mid [x auto]
            Leaf [x]
        `,
      ),
    );
    const { changes } = addStep(steps, { goalId: 'g1', parentId: 'Mid', title: 'New' }, ctx);
    expect(changes.map((c) => c.id).sort()).toEqual(['Mid', 'Root', 'new-2'].sort());
    const after = apply(steps, changes);
    expect(byId(after, 'Mid')).not.toHaveProperty('completedAt');
    expect(byId(after, 'Mid')).not.toHaveProperty('autoCompleted');
    expect(render(after, 'g1')).toBe(
      dedent(`
        Root
          Mid
            Leaf [x]
            New
      `),
    );
  });

  it('validates the parent and position', () => {
    const steps = thesis();
    expectTreeError(() => addStep(steps, { goalId: 'g1', parentId: 'nope' }), 'not-found');
    expectTreeError(() => addStep(steps, { goalId: 'g2', parentId: 'Draft RQs' }), 'goal-mismatch');
    expectTreeError(
      () => addStep(steps, { goalId: 'g1', position: { afterId: 'Draft RQs' } }),
      'not-a-sibling',
    );
  });
});

describe('updateStep', () => {
  it('changes plain fields and bumps updatedAt only on that step', () => {
    const changes = updateStep(
      thesis(),
      'Draft RQs',
      { title: 'Draft 3 RQs', notes: 'n' },
      { now: T2 },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      id: 'Draft RQs',
      title: 'Draft 3 RQs',
      notes: 'n',
      updatedAt: T2,
    });
  });
});

describe('moveStep', () => {
  it('reorders within the same parent, changing only that step', () => {
    const steps = thesis();
    const changes = moveStep(
      steps,
      'Ask supervisor',
      { parentId: 'Find sources', position: { index: 0 } },
      { now: T1 },
    );
    expect(changes.map((c) => c.id)).toEqual(['Ask supervisor']);
    expect(changes[0]!.updatedAt).toBe(T1);
    expect(getChildren(apply(steps, changes), 'g1', 'Find sources').map((s) => s.id)).toEqual([
      'Ask supervisor',
      'Search Scopus',
    ]);
  });

  it('moves a whole branch to a new parent', () => {
    const steps = thesis();
    const after = apply(
      steps,
      moveStep(steps, 'Write summaries', { parentId: 'Methodology', position: { afterId: null } }),
    );
    expect(render(after, 'g1')).toBe(
      dedent(`
        Lit review
          Find sources
            Search Scopus [x]
            Ask supervisor
        Methodology
          Write summaries
            Paper A [x]
            Paper B
          Draft RQs
      `),
    );
  });

  it('moves to the top level', () => {
    const steps = thesis();
    const after = apply(
      steps,
      moveStep(steps, 'Draft RQs', { parentId: null, position: { index: 0 } }),
    );
    expect(getChildren(after, 'g1', null).map((s) => s.id)).toEqual([
      'Draft RQs',
      'Lit review',
      'Methodology',
    ]);
  });

  it('refuses to move a step into its own branch', () => {
    const steps = thesis();
    expectTreeError(() => moveStep(steps, 'Lit review', { parentId: 'Lit review' }), 'cycle');
    expectTreeError(() => moveStep(steps, 'Lit review', { parentId: 'Paper B' }), 'cycle');
  });

  it('moves a branch to another goal, updating every descendant', () => {
    const steps = thesis();
    const changes = moveStep(steps, 'Write summaries', { parentId: null, goalId: 'g2' });
    expect(changes.map((c) => [c.id, c.goalId])).toEqual([
      ['Write summaries', 'g2'],
      ['Paper A', 'g2'],
      ['Paper B', 'g2'],
    ]);
    const after = apply(steps, changes);
    expect(render(after, 'g2')).toBe(
      dedent(`
        Write summaries
          Paper A [x]
          Paper B
      `),
    );
  });

  it('rejects a goalId that contradicts the parent', () => {
    expectTreeError(
      () => moveStep(thesis(), 'Draft RQs', { parentId: 'Lit review', goalId: 'g2' }),
      'goal-mismatch',
    );
  });

  it('reopens a done parent when open work moves under it', () => {
    const steps = outline(
      'g1',
      `
      Done [x auto]
        Child [x]
      Open
      `,
    );
    const after = apply(steps, moveStep(steps, 'Open', { parentId: 'Done' }));
    expect(byId(after, 'Done').status).toBe('open');
  });

  it('auto-completes the old parent when its last open child moves away', () => {
    const steps = outline(
      'g1',
      `
      Parent
        Finished [x]
        Pending
      Elsewhere
      `,
    );
    const changes = moveStep(steps, 'Pending', { parentId: 'Elsewhere' }, { now: T1 });
    const after = apply(steps, changes);
    expect(byId(after, 'Parent')).toMatchObject({
      status: 'done',
      autoCompleted: true,
      completedAt: T1,
    });
  });

  it('does not auto-complete an open leaf that receives a done step', () => {
    const steps = outline(
      'g1',
      `
      Leaf
      Finished [x]
      `,
    );
    const after = apply(steps, moveStep(steps, 'Finished', { parentId: 'Leaf' }));
    expect(byId(after, 'Leaf').status).toBe('open');
  });
});

describe('indentStep / outdentStep', () => {
  it('Tab makes the step the last child of the sibling above', () => {
    const steps = outline(
      'g1',
      `
      A
        A1
      B
      C
      `,
    );
    const after = apply(steps, indentStep(steps, 'B'));
    expect(render(after, 'g1')).toBe(
      dedent(`
        A
          A1
          B
        C
      `),
    );
  });

  it('Tab on the first sibling does nothing', () => {
    expect(indentStep(thesis(), 'Lit review')).toEqual([]);
    expect(indentStep(thesis(), 'Search Scopus')).toEqual([]);
  });

  it('Tab skips hidden completed siblings unless they are shown', () => {
    const steps = outline(
      'g1',
      `
      A
      Done [x]
      B
      `,
    );
    const hidden = apply(steps, indentStep(steps, 'B'));
    expect(byId(hidden, 'B').parentId).toBe('A');

    const shown = apply(steps, indentStep(steps, 'B', { includeCompleted: true }));
    expect(byId(shown, 'B').parentId).toBe('Done');
    // Open work now lives under "Done", so it is reopened.
    expect(byId(shown, 'Done').status).toBe('open');
  });

  it('Shift+Tab places the step directly below its parent', () => {
    const steps = outline(
      'g1',
      `
      A
        A1
        A2
        A3
      B
      `,
    );
    const after = apply(steps, outdentStep(steps, 'A2'));
    expect(render(after, 'g1')).toBe(
      dedent(`
        A
          A1
          A3
        A2
        B
      `),
    );
  });

  it('Shift+Tab keeps the branch and works at deeper levels', () => {
    const steps = thesis();
    const after = apply(steps, outdentStep(steps, 'Find sources'));
    expect(render(after, 'g1')).toBe(
      dedent(`
        Lit review
          Write summaries
            Paper A [x]
            Paper B
        Find sources
          Search Scopus [x]
          Ask supervisor
        Methodology
          Draft RQs
      `),
    );
  });

  it('Shift+Tab on a top-level step does nothing', () => {
    expect(outdentStep(thesis(), 'Methodology')).toEqual([]);
  });

  it('Shift+Tab of the last open child auto-completes the old parent', () => {
    const steps = outline(
      'g1',
      `
      A
        Done [x]
        Open
      `,
    );
    const after = apply(steps, outdentStep(steps, 'Open'));
    expect(byId(after, 'A')).toMatchObject({ status: 'done', autoCompleted: true });
  });
});

describe('completeStep', () => {
  it('completes a leaf with a timestamp', () => {
    const changes = completeStep(thesis(), 'Paper B', {}, { now: T1 });
    expect(changes.find((c) => c.id === 'Paper B')).toMatchObject({
      status: 'done',
      completedAt: T1,
      updatedAt: T1,
    });
    expect(changes.find((c) => c.id === 'Paper B')).not.toHaveProperty('autoCompleted');
  });

  it('auto-completes the parent when the last child finishes', () => {
    const steps = thesis();
    const changes = completeStep(steps, 'Paper B', {}, { now: T1 });
    expect(changes.map((c) => c.id)).toEqual(['Paper B', 'Write summaries']);
    expect(byId(changes, 'Write summaries')).toMatchObject({
      status: 'done',
      autoCompleted: true,
      completedAt: T1,
    });
    // Grandparent still has open work under "Find sources".
    expect(byId(apply(steps, changes), 'Lit review').status).toBe('open');
  });

  it('auto-completes recursively up the tree', () => {
    let steps: Step[] = [...thesis()];
    steps = apply(steps, completeStep(steps, 'Paper B', {}, { now: T1 }));
    const changes = completeStep(steps, 'Ask supervisor', {}, { now: T2 });
    expect(changes.map((c) => c.id)).toEqual(['Ask supervisor', 'Find sources', 'Lit review']);
    expect(changes.every((c) => c.completedAt === T2)).toBe(true);
    expect(goalProgress(apply(steps, changes), 'g1')).toEqual({ done: 4, total: 5, ratio: 0.8 });
  });

  it('refuses to complete a step with open descendants without cascade', () => {
    expectTreeError(() => completeStep(thesis(), 'Lit review'), 'open-descendants');
  });

  it('cascade completes every open descendant in one batch', () => {
    const steps = thesis();
    const changes = completeStep(steps, 'Lit review', { cascade: true }, { now: T1 });
    expect(changes.map((c) => c.id).sort()).toEqual(
      ['Lit review', 'Find sources', 'Ask supervisor', 'Write summaries', 'Paper B'].sort(),
    );
    expect(changes.every((c) => c.completedAt === T1 && c.status === 'done')).toBe(true);
    // Previously completed steps keep their original timestamp.
    expect(byId(apply(steps, changes), 'Search Scopus').completedAt).toBe(T0);
    expect(buildTree(apply(steps, changes), 'g1').map((n) => n.step.id)).toEqual(['Methodology']);
  });

  it('completing a done step is a no-op', () => {
    expect(completeStep(thesis(), 'Search Scopus')).toEqual([]);
  });

  it('produces records that still pass the schema', () => {
    const changes = completeStep(thesis(), 'Lit review', { cascade: true });
    for (const c of changes) expect(stepSchema.safeParse(c).success).toBe(true);
  });
});

describe('uncompleteStep (undo)', () => {
  it('undoing the child that finished a branch restores both', () => {
    const steps = thesis();
    const completed = apply(steps, completeStep(steps, 'Paper B', {}, { now: T1 }));
    const changes = uncompleteStep(completed, 'Paper B', { now: T2 });
    expect(changes.map((c) => c.id)).toEqual(['Paper B', 'Write summaries']);
    const after = apply(completed, changes);
    expect(render(after, 'g1')).toBe(render(steps, 'g1'));
    expect(byId(after, 'Write summaries')).not.toHaveProperty('autoCompleted');
  });

  it('undoing an auto-completed parent also reopens the child that completed it', () => {
    const steps = thesis();
    const completed = apply(steps, completeStep(steps, 'Paper B', {}, { now: T1 }));
    const after = apply(completed, uncompleteStep(completed, 'Write summaries'));
    expect(byId(after, 'Paper B').status).toBe('open');
    expect(byId(after, 'Paper A').status).toBe('done');
  });

  it('undoing a cascade reopens exactly the steps it completed', () => {
    const steps = thesis();
    const completed = apply(
      steps,
      completeStep(steps, 'Lit review', { cascade: true }, { now: T1 }),
    );
    const after = apply(completed, uncompleteStep(completed, 'Lit review'));
    expect(render(after, 'g1')).toBe(render(steps, 'g1'));
  });

  it('undoing a recursive auto-completion restores the whole chain', () => {
    let steps: Step[] = [...thesis()];
    steps = apply(steps, completeStep(steps, 'Paper B', {}, { now: T1 }));
    const before = steps;
    steps = apply(steps, completeStep(steps, 'Ask supervisor', {}, { now: T2 }));
    const after = apply(steps, uncompleteStep(steps, 'Ask supervisor'));
    expect(render(after, 'g1')).toBe(render(before, 'g1'));
  });

  it('undoing an old completion leaves later ones alone but reopens ancestors', () => {
    let steps: Step[] = [...thesis()];
    steps = apply(steps, completeStep(steps, 'Paper B', {}, { now: T1 }));
    // "Paper A" was completed at T0, long before the branch finished.
    const after = apply(steps, uncompleteStep(steps, 'Paper A'));
    expect(byId(after, 'Paper A').status).toBe('open');
    expect(byId(after, 'Paper B').status).toBe('done');
    expect(byId(after, 'Write summaries').status).toBe('open');
  });

  it('uncompleting an open step is a no-op', () => {
    expect(uncompleteStep(thesis(), 'Paper B')).toEqual([]);
  });
});

describe('deleteStep', () => {
  it('soft-deletes the whole branch', () => {
    const steps = thesis();
    const changes = deleteStep(steps, 'Find sources', { now: T1 });
    expect(changes.map((c) => c.id)).toEqual(['Find sources', 'Search Scopus', 'Ask supervisor']);
    expect(changes.every((c) => c.deleted && c.updatedAt === T1)).toBe(true);
    const after = apply(steps, changes);
    expect(after).toHaveLength(steps.length);
    expect(render(after, 'g1')).toBe(
      dedent(`
        Lit review
          Write summaries
            Paper A [x]
            Paper B
        Methodology
          Draft RQs
      `),
    );
  });

  it('auto-completes the parent when the last open child is deleted', () => {
    const steps = thesis();
    const after = apply(steps, deleteStep(steps, 'Paper B', { now: T1 }));
    expect(byId(after, 'Write summaries')).toMatchObject({ status: 'done', autoCompleted: true });
  });

  it('a parent whose only child is deleted becomes an open leaf again', () => {
    const steps = thesis();
    const after = apply(steps, deleteStep(steps, 'Draft RQs'));
    expect(byId(after, 'Methodology').status).toBe('open');
    expect(buildTree(after, 'g1')[1]!.isLeaf).toBe(true);
  });

  it('throws for an already deleted step', () => {
    const steps = thesis();
    const after = apply(steps, deleteStep(steps, 'Draft RQs'));
    expectTreeError(() => deleteStep(after, 'Draft RQs'), 'not-found');
  });
});

describe('purity', () => {
  it('never mutates the input records (they are frozen)', () => {
    const steps = thesis();
    expect(() => {
      addStep(steps, { goalId: 'g1', parentId: 'Search Scopus' });
      moveStep(steps, 'Paper B', { parentId: null });
      indentStep(steps, 'Methodology');
      outdentStep(steps, 'Paper B');
      completeStep(steps, 'Lit review', { cascade: true });
      uncompleteStep(steps, 'Search Scopus');
      deleteStep(steps, 'Lit review');
      updateStep(steps, 'Paper B', { title: 'x' });
    }).not.toThrow();
    expect(render(steps, 'g1')).toBe(render(thesis(), 'g1'));
  });
});
