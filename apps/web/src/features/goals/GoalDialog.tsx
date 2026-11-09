import { useId, useState, type FormEvent } from 'react';
import { DEFAULT_GOAL_COLOR, type Goal, type GoalKind } from '@planning/shared';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { GOAL_COLORS } from './colors';

const KINDS: { value: GoalKind; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'exam', label: 'Exam' },
  { value: 'other', label: 'Other' },
];

export interface GoalFormValues {
  title: string;
  kind: GoalKind;
  course?: string;
  color: string;
  emoji?: string;
  deadline?: string;
}

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing goal to edit; omitted = create a new one. */
  goal?: Goal;
  onSubmit: (values: GoalFormValues) => void | Promise<void>;
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30';

export function GoalDialog({ open, onOpenChange, goal, onSubmit }: GoalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted per opening, so the form always starts from the goal's current values. */}
        {open && <GoalForm goal={goal} onSubmit={onSubmit} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({
  goal,
  onSubmit,
  onClose,
}: {
  goal: Goal | undefined;
  onSubmit: GoalDialogProps['onSubmit'];
  onClose: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'other');
  const [course, setCourse] = useState(goal?.course ?? '');
  const [color, setColor] = useState(goal?.color ?? DEFAULT_GOAL_COLOR);
  const [emoji, setEmoji] = useState(goal?.emoji ?? '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await onSubmit({
      title: title.trim(),
      kind,
      color,
      ...(course.trim() ? { course: course.trim() } : {}),
      ...(emoji.trim() ? { emoji: emoji.trim() } : {}),
      ...(deadline ? { deadline } : {}),
    });
    onClose();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{goal ? 'Edit goal' : 'New goal'}</DialogTitle>
        <DialogDescription>
          A big thing to break down: an assignment, a thesis chapter, an exam.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ML course – Assignment 3"
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-kind`}>Tag</Label>
          <select
            id={`${id}-kind`}
            className={selectClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as GoalKind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-deadline`}>Deadline</Label>
          <Input
            id={`${id}-deadline`}
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-course`}>Course (optional)</Label>
        <Input
          id={`${id}-course`}
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="Advanced ML"
        />
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Colour</span>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colour">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(
                'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition',
                color === c && 'ring-2 ring-ring',
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="size-4 text-white" />}
            </button>
          ))}
          <Input
            aria-label="Emoji (optional)"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🙂"
            maxLength={8}
            className="ml-auto w-16 text-center"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          {goal ? 'Save' : 'Create goal'}
        </Button>
      </DialogFooter>
    </form>
  );
}
