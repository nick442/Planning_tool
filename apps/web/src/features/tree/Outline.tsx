import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { buildTree, type Goal, type Step } from '@planning/shared';
import { Plus } from 'lucide-react';
import { useUiStore } from '@/app/store';
import { toggleWithFeedback, useLeavingStore } from '@/features/completed/completion';
import { Button } from '@/components/ui/button';
import {
  flattenVisible,
  getProjection,
  visibleSibling,
  withoutDescendants,
  type FlatRow,
} from './outlineModel';
import { INDENT_PX, StepRow, type StepRowHandlers } from './StepRow';
import {
  addChild,
  addSiblingBelow,
  addStepAt,
  indent,
  move,
  outdent,
  removeStep,
  renameStep,
  setNotes,
} from './stepActions';

interface OutlineProps {
  goal: Goal;
  steps: Step[];
}

/** The row to focus after `row` (and its branch) disappears: the next one, else the previous. */
function neighbourAfterRemoval(rows: readonly FlatRow[], row: FlatRow): FlatRow | undefined {
  const index = rows.findIndex((r) => r.id === row.id);
  for (let i = index + 1; i < rows.length; i++) {
    if (rows[i]!.depth <= row.depth) return rows[i];
  }
  return rows[index - 1];
}

export function Outline({ goal, steps }: OutlineProps) {
  const showCompleted = useUiStore((s) => s.showCompleted);
  const leaving = useLeavingStore((s) => s.leaving);
  const setShowCompleted = useUiStore((s) => s.setShowCompleted);
  const collapsed = useUiStore((s) => s.collapsed);
  const focusedStepId = useUiStore((s) => s.focusedStepId);
  const editingStepId = useUiStore((s) => s.editingStepId);

  const tree = useMemo(
    () =>
      buildTree(steps, goal.id, {
        // Just-completed steps stay a moment longer so they can animate out.
        includeCompleted: showCompleted || ((step) => leaving[step.id] === true),
      }),
    [steps, goal.id, showCompleted, leaving],
  );
  const rows = useMemo(() => flattenVisible(tree, collapsed), [tree, collapsed]);
  const doneCount = useMemo(
    () => steps.filter((s) => s.goalId === goal.id && !s.deleted && s.status === 'done').length,
    [steps, goal.id],
  );

  // Handlers read the latest rows through a ref so they can stay stable.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const handlers = useMemo<StepRowHandlers>(() => {
    const ui = () => useUiStore.getState();
    const indexOf = (id: string) => rowsRef.current.findIndex((r) => r.id === id);
    const rowAt = (i: number) => rowsRef.current[i];

    const startEditing = (id: string) => ui().editStep(id);
    const focusRow = (id: string | undefined) => {
      if (id) ui().focusStep(id);
    };
    const expand = (id: string) => ui().setCollapsed(id, false);
    const saveTitle = (step: Step, value: string) => {
      if (value.trim() !== '') renameStep(step, value);
    };

    /** Leaves edit mode: an empty leaf step is removed, others keep their title. */
    const finishEditing = (row: FlatRow, value: string, refocus: boolean) => {
      const state = ui();
      if (state.editingStepId === row.id) state.editStep(null);
      if (value.trim() === '' && row.node.isLeaf) {
        const neighbour = neighbourAfterRemoval(rowsRef.current, row);
        void removeStep(row.node.step, { ask: false });
        if (refocus) focusRow(neighbour?.id);
        return;
      }
      saveTitle(row.node.step, value);
      if (refocus) focusRow(row.id);
    };

    const moveAmongSiblings = (row: FlatRow, direction: 'up' | 'down') => {
      const sibling = visibleSibling(rowsRef.current, row.id, direction);
      if (!sibling) return;
      const step = row.node.step;
      move(step, {
        parentId: step.parentId,
        goalId: step.goalId,
        position: direction === 'up' ? { beforeId: sibling.id } : { afterId: sibling.id },
      });
    };

    const indentRow = (row: FlatRow) => {
      // Expand the new parent so the step stays visible.
      const above = visibleSibling(rowsRef.current, row.id, 'up');
      if (above) expand(above.id);
      indent(row.node.step, ui().showCompleted);
    };

    const toggle = async (row: FlatRow) => {
      const hides = row.node.step.status === 'open' && !ui().showCompleted;
      const neighbour = hides ? neighbourAfterRemoval(rowsRef.current, row) : undefined;
      const changed = await toggleWithFeedback(row.node.step);
      if (changed && hides && ui().focusedStepId === row.id) focusRow(neighbour?.id);
    };

    return {
      onFocusRow: (row) => {
        const state = ui();
        if (state.focusedStepId !== row.id) state.focusStep(row.id);
      },

      onStartEdit: (row) => startEditing(row.id),

      onCommitTitle: saveTitle,

      onClickAway: (row, value) => finishEditing(row, value, false),

      onToggleCollapse: (row) => ui().setCollapsed(row.id, !row.collapsed),

      onToggleComplete: (row) => void toggle(row),

      onAddChild: (row) => {
        expand(row.id);
        startEditing(addChild(row.node.step));
      },

      onSaveNotes: setNotes,

      onNavKey: (event, row) => {
        const i = indexOf(row.id);
        const step = row.node.step;
        const key = event.key;

        if (key === 'ArrowUp' || key === 'ArrowDown') {
          event.preventDefault();
          if (event.altKey) moveAmongSiblings(row, key === 'ArrowUp' ? 'up' : 'down');
          else focusRow(rowAt(key === 'ArrowUp' ? i - 1 : i + 1)?.id);
        } else if (key === 'ArrowLeft') {
          event.preventDefault();
          if (row.hasChildren && !row.collapsed) ui().setCollapsed(row.id, true);
          else focusRow(step.parentId ?? undefined);
        } else if (key === 'ArrowRight') {
          event.preventDefault();
          if (row.collapsed) expand(row.id);
          else if (row.hasChildren) focusRow(rowAt(i + 1)?.id);
        } else if (key === 'Enter') {
          event.preventDefault();
          startEditing(addSiblingBelow(step));
        } else if (key === 'F2' || key === 'e') {
          event.preventDefault();
          startEditing(row.id);
        } else if (key === 'Tab') {
          event.preventDefault();
          if (event.shiftKey) outdent(step);
          else indentRow(row);
        } else if (key === ' ') {
          event.preventDefault();
          void toggle(row);
        } else if (key === 'Delete' || key === 'Backspace') {
          event.preventDefault();
          const neighbour = neighbourAfterRemoval(rowsRef.current, row);
          void removeStep(step).then((removed) => removed && focusRow(neighbour?.id));
        } else if (key === 'Escape') {
          event.preventDefault();
          ui().focusStep(null);
          event.currentTarget.blur();
        }
      },

      onEditKey: (event, row, value) => {
        if (event.nativeEvent.isComposing) return;
        const step = row.node.step;
        const i = indexOf(row.id);
        const key = event.key;

        if (key === 'Enter') {
          event.preventDefault();
          if (value.trim() === '') {
            // Enter on an empty step ends the quick-entry flow.
            finishEditing(row, value, true);
            return;
          }
          renameStep(step, value);
          // On an expanded parent, Enter starts its first child; otherwise a sibling below.
          startEditing(
            row.hasChildren && !row.collapsed
              ? addStepAt(step.goalId, step.id, { afterId: null })
              : addSiblingBelow(step),
          );
        } else if (key === 'Escape') {
          event.preventDefault();
          finishEditing(row, value, true);
        } else if (key === 'Tab') {
          event.preventDefault();
          saveTitle(step, value);
          if (event.shiftKey) outdent(step);
          else indentRow(row);
        } else if (key === 'Backspace' && value === '' && row.node.isLeaf) {
          event.preventDefault();
          const previous = rowAt(i - 1);
          if (ui().editingStepId === row.id) ui().editStep(null);
          void removeStep(step, { ask: false });
          if (previous) startEditing(previous.id);
        } else if ((key === 'ArrowUp' || key === 'ArrowDown') && event.altKey) {
          event.preventDefault();
          saveTitle(step, value);
          moveAmongSiblings(row, key === 'ArrowUp' ? 'up' : 'down');
        } else if (key === 'ArrowUp' || key === 'ArrowDown') {
          const target = rowAt(key === 'ArrowUp' ? i - 1 : i + 1);
          if (!target) return;
          event.preventDefault();
          saveTitle(step, value);
          startEditing(target.id);
        }
      },
    };
  }, []);

  // Clicking outside the outline clears the row focus.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const state = useUiStore.getState();
      if (state.focusedStepId && !containerRef.current?.contains(event.target as Node)) {
        if (!state.editingStepId) state.focusStep(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // ---- drag and drop --------------------------------------------------------
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const dragRows = useMemo(
    () => (activeId ? withoutDescendants(rows, activeId) : rows),
    [rows, activeId],
  );
  const projection =
    activeId && overId ? getProjection(dragRows, activeId, overId, offsetX, INDENT_PX) : null;

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(String(active.id));
  };
  const onDragMove = ({ delta }: DragMoveEvent) => setOffsetX(delta.x);
  const onDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const final =
      over && getProjection(dragRows, String(active.id), String(over.id), offsetX, INDENT_PX);
    const row = rows.find((r) => r.id === active.id);
    resetDrag();
    if (!final || !row) return;
    const step = row.node.step;
    if (final.parentId) useUiStore.getState().setCollapsed(final.parentId, false);
    move(step, {
      parentId: final.parentId,
      goalId: step.goalId,
      ...(final.position ? { position: final.position } : {}),
    });
  };

  const addTopLevel = useCallback(() => {
    useUiStore.getState().editStep(addStepAt(goal.id, null));
  }, [goal.id]);

  return (
    <div ref={containerRef} className="space-y-2">
      {rows.every((r) => !showCompleted && leaving[r.id]) && (
        <p className="py-6 text-sm text-muted-foreground">
          {doneCount > 0 && !showCompleted
            ? 'Everything here is done. 🎉'
            : 'Break this goal into a few big steps, then split each one until the next action is obvious.'}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
        <SortableContext items={dragRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul role="tree" aria-label="Outline" className="flex flex-col">
            {dragRows.map((row, index) => (
              <StepRow
                key={row.id}
                row={row}
                focused={row.id === focusedStepId}
                editing={row.id === editingStepId}
                leaving={!showCompleted && leaving[row.id] === true}
                tabbable={focusedStepId === null && index === 0}
                {...(row.id === activeId && projection ? { dragDepth: projection.depth } : {})}
                handlers={handlers}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={addTopLevel}>
          <Plus /> Add step
        </Button>
        {doneCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="accent-current"
            />
            Show completed ({doneCount})
          </label>
        )}
      </div>
    </div>
  );
}
