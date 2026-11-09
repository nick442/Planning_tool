import { useState } from 'react';
import type { Goal, Progress } from '@planning/shared';
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useUiStore } from '@/app/store';
import { confirm } from '@/components/confirm';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GoalBadge } from './GoalBadge';
import { GoalDialog } from './GoalDialog';
import { countdown, useToday } from './deadline';
import { deleteGoal, editGoal } from './goalActions';

const KIND_LABEL: Record<Goal['kind'], string> = {
  course: 'Course',
  thesis: 'Thesis',
  exam: 'Exam',
  other: 'Other',
};

export function GoalHeader({ goal, progress }: { goal: Goal; progress: Progress }) {
  const [editing, setEditing] = useState(false);
  const selectGoal = useUiStore((s) => s.selectGoal);
  const today = useToday();
  const due = goal.deadline ? countdown(goal.deadline, today) : null;
  const percent = Math.round(progress.ratio * 100);

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete "${goal.title}"?`,
      description: 'The goal and all its steps disappear from every device.',
      confirmLabel: 'Delete goal',
      destructive: true,
    });
    if (!ok) return;
    deleteGoal(goal.id);
    selectGoal(null);
  };

  return (
    <header className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <GoalBadge goal={goal} className="size-3 text-xl" />
            <span className="truncate">{goal.title}</span>
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {KIND_LABEL[goal.kind]}
              {goal.course ? ` · ${goal.course}` : ''}
            </span>
            {due && (
              <span className="inline-flex items-center gap-1" title={due.date}>
                <CalendarClock className="size-3.5" />
                {due.long} <span className="text-muted-foreground/70">({due.date})</span>
              </span>
            )}
            {goal.archived && <span>Archived</span>}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Goal actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Edit goal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editGoal(goal.id, { archived: !goal.archived })}>
              {goal.archived ? <ArchiveRestore /> : <Archive />}
              {goal.archived ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void onDelete()}>
              <Trash2 /> Delete goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3">
        <ProgressBar value={progress.ratio} label={`${goal.title} progress`} />
        <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
          {percent}%
        </span>
      </div>

      <GoalDialog
        open={editing}
        onOpenChange={setEditing}
        goal={goal}
        onSubmit={(values) =>
          editGoal(goal.id, {
            title: values.title,
            kind: values.kind,
            color: values.color,
            course: values.course,
            emoji: values.emoji,
            deadline: values.deadline,
          })
        }
      />
    </header>
  );
}
