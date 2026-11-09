import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { goalProgress, sortGoals, type Goal, type Step } from '@planning/shared';
import { Archive, GripVertical, Plus } from 'lucide-react';
import { useUiStore } from '@/app/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GoalBadge } from './GoalBadge';
import { GoalDialog } from './GoalDialog';
import { countdown, useToday } from './deadline';
import { addGoal, reorderGoal } from './goalActions';

interface GoalSidebarProps {
  goals: Goal[];
  steps: Step[];
}

export function GoalSidebar({ goals, steps }: GoalSidebarProps) {
  const selectedGoalId = useUiStore((s) => s.selectedGoalId);
  const selectGoal = useUiStore((s) => s.selectGoal);
  const showArchived = useUiStore((s) => s.showArchived);
  const setShowArchived = useUiStore((s) => s.setShowArchived);
  const [creating, setCreating] = useState(false);
  const today = useToday();

  const visible = useMemo(
    () => sortGoals(goals, { includeArchived: showArchived }),
    [goals, showArchived],
  );
  const archivedCount = goals.filter((g) => g.archived && !g.deleted).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Long-press to drag on touch screens.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = visible.findIndex((g) => g.id === active.id);
    const to = visible.findIndex((g) => g.id === over.id);
    if (from !== -1 && to !== -1) reorderGoal(visible, from, to);
  };

  return (
    <nav aria-label="Goals" className="flex h-full flex-col gap-1">
      <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Goals
      </h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={visible.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-0.5" aria-label="Goal list">
            {visible.map((goal) => (
              <SortableGoal
                key={goal.id}
                goal={goal}
                percent={Math.round(goalProgress(steps, goal.id).ratio * 100)}
                countdownText={goal.deadline ? countdown(goal.deadline, today).short : undefined}
                selected={goal.id === selectedGoalId}
                onSelect={() => selectGoal(goal.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {visible.length === 0 && (
        <p className="px-2 py-3 text-sm text-muted-foreground">
          No goals yet. Start with the big thing that's been on your mind.
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="justify-start text-muted-foreground"
        onClick={() => setCreating(true)}
      >
        <Plus /> New goal
      </Button>

      {archivedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          aria-pressed={showArchived}
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive /> {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
        </Button>
      )}

      <GoalDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={(values) => selectGoal(addGoal(values).id)}
      />
    </nav>
  );
}

interface SortableGoalProps {
  goal: Goal;
  percent: number;
  countdownText: string | undefined;
  selected: boolean;
  onSelect: () => void;
}

function SortableGoal({ goal, percent, countdownText, selected, onSelect }: SortableGoalProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1 rounded-md pr-2',
        selected ? 'bg-accent' : 'hover:bg-accent/60',
        isDragging && 'relative z-10 opacity-80 shadow-sm',
        goal.archived && 'opacity-60',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder ${goal.title}`}
        className="cursor-grab touch-none px-1 py-2 text-muted-foreground/50 opacity-100 hover:text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'page' : undefined}
        className="flex min-w-0 flex-1 flex-col items-start py-1.5 text-left"
      >
        <span className="flex w-full items-center gap-2">
          <GoalBadge goal={goal} />
          <span className="truncate text-sm font-medium">{goal.title}</span>
        </span>
        <span className="pl-[18px] text-xs tabular-nums text-muted-foreground">
          {percent}%{countdownText ? ` · ${countdownText}` : ''}
        </span>
      </button>
    </li>
  );
}
