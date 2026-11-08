import {
  memo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Step } from '@planning/shared';
import { Check, ChevronDown, ChevronRight, GripVertical, NotebookPen, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlatRow } from './outlineModel';

export const INDENT_PX = 20;

export interface StepRowHandlers {
  onFocusRow: (row: FlatRow) => void;
  onNavKey: (event: KeyboardEvent<HTMLDivElement>, row: FlatRow) => void;
  onEditKey: (event: KeyboardEvent<HTMLInputElement>, row: FlatRow, value: string) => void;
  onStartEdit: (row: FlatRow) => void;
  /** Saves the title without leaving edit mode (e.g. on blur). */
  onCommitTitle: (step: Step, value: string) => void;
  /** Leaves edit mode because the user clicked somewhere else. */
  onClickAway: (row: FlatRow, value: string) => void;
  onToggleCollapse: (row: FlatRow) => void;
  onToggleComplete: (row: FlatRow) => void;
  onAddChild: (row: FlatRow) => void;
  onSaveNotes: (step: Step, notes: string) => void;
}

interface StepRowProps {
  row: FlatRow;
  focused: boolean;
  editing: boolean;
  /** First row gets tabIndex 0 when nothing is focused (roving tabindex). */
  tabbable: boolean;
  /** Depth to render at while this row is being dragged. */
  dragDepth?: number;
  handlers: StepRowHandlers;
}

function StepRowImpl({ row, focused, editing, tabbable, dragDepth, handlers }: StepRowProps) {
  const { step, progress, isLeaf } = row.node;
  const done = step.status === 'done';
  const rowRef = useRef<HTMLDivElement>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  // Keep keyboard focus where the UI state says it is. A row takes focus when
  // it becomes focused or starts editing. On later renders it only takes focus
  // back when it was lost (e.g. the row moved in the DOM after Tab) or sits on
  // another outline row, never stealing it from the notes field, the sidebar
  // or a dialog.
  const previous = useRef({ focused: false, editing: false });
  useEffect(() => {
    const became = (focused && !previous.current.focused) || (editing && !previous.current.editing);
    previous.current = { focused, editing };
    const active = document.activeElement;
    const movable =
      became ||
      active === null ||
      active === document.body ||
      (active instanceof HTMLElement && active.hasAttribute('data-outline-focus'));
    if (!movable) return;
    if (editing) {
      const input = rowRef.current?.querySelector('input');
      if (input && active !== input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    } else if (focused && rowRef.current && active !== rowRef.current) {
      rowRef.current.focus();
    }
  });

  const depth = dragDepth ?? row.depth;
  const percent = Math.round(progress.ratio * 100);
  const openLeaves = progress.total - progress.done;

  let meta: ReactNode = null;
  if (row.collapsed) meta = `${openLeaves} open`;
  else if (!isLeaf) meta = `${percent}%`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
      className={cn(isDragging && 'relative z-10')}
    >
      <div
        ref={rowRef}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-expanded={row.hasChildren ? !row.collapsed : undefined}
        aria-selected={focused}
        aria-label={step.title || 'Untitled step'}
        data-step-id={step.id}
        data-outline-focus=""
        tabIndex={focused || tabbable ? 0 : -1}
        onFocus={(e) => {
          if (e.target === e.currentTarget || !focused) handlers.onFocusRow(row);
        }}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget) handlers.onNavKey(e, row);
        }}
        className={cn(
          'group flex min-h-9 items-center gap-1 rounded-md pr-1 outline-none',
          focused && !editing ? 'bg-accent ring-1 ring-ring/40' : 'hover:bg-accent/50',
          isDragging && 'bg-background shadow-md ring-1 ring-ring/40',
        )}
        style={{ paddingLeft: depth * INDENT_PX }}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="Drag to move"
          className="cursor-grab touch-none p-0.5 text-muted-foreground/40 opacity-100 hover:text-muted-foreground md:opacity-0 md:group-hover:opacity-100"
          {...attributes}
          {...listeners}
          tabIndex={-1}
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label={row.collapsed ? 'Expand' : 'Collapse'}
          onClick={() => handlers.onToggleCollapse(row)}
          className={cn(
            'rounded p-0.5 text-muted-foreground hover:bg-accent',
            !row.hasChildren && 'invisible',
          )}
        >
          {row.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        <button
          type="button"
          role="checkbox"
          tabIndex={-1}
          aria-checked={done}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          onClick={() => handlers.onToggleComplete(row)}
          className={cn(
            'flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
            done
              ? 'border-success bg-success text-white'
              : 'border-muted-foreground/40 hover:border-success',
          )}
        >
          {done && <Check className="size-3" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1 pl-1.5">
          {editing ? (
            <TitleInput row={row} rowRef={rowRef} handlers={handlers} />
          ) : (
            <span
              onClick={() => handlers.onStartEdit(row)}
              className={cn(
                'block cursor-text truncate py-1',
                done && 'text-muted-foreground line-through',
                !step.title && 'text-muted-foreground/60 italic',
              )}
            >
              {step.title || 'Untitled'}
            </span>
          )}
        </div>

        {meta !== null && (
          <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">{meta}</span>
        )}

        <button
          type="button"
          tabIndex={-1}
          aria-label={notesOpen ? 'Hide notes' : 'Notes'}
          aria-pressed={notesOpen}
          onClick={() => setNotesOpen(!notesOpen)}
          className={cn(
            'rounded p-1 text-muted-foreground hover:bg-accent',
            step.notes ? 'opacity-70' : 'opacity-0 group-hover:opacity-100 max-md:hidden',
          )}
        >
          <NotebookPen className="size-3.5" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Add sub-step"
          onClick={() => handlers.onAddChild(row)}
          className="rounded p-1 text-muted-foreground hover:bg-accent md:opacity-0 md:group-hover:opacity-100"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {notesOpen && (
        <div style={{ paddingLeft: depth * INDENT_PX + 64 }} className="pb-2 pr-2">
          <NotesField step={step} onSave={handlers.onSaveNotes} />
        </div>
      )}
    </li>
  );
}

/**
 * The inline title editor. Mounted only while editing, so each edit starts
 * from the stored title.
 */
function TitleInput({
  row,
  rowRef,
  handlers,
}: {
  row: FlatRow;
  rowRef: RefObject<HTMLDivElement | null>;
  handlers: StepRowHandlers;
}) {
  const step = row.node.step;
  const [draft, setDraft] = useState(step.title);

  // A click anywhere outside the row ends the edit.
  const latest = useRef({ row, draft });
  useEffect(() => {
    latest.current = { row, draft };
  });
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) {
        handlers.onClickAway(latest.current.row, latest.current.draft);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [handlers, rowRef]);

  return (
    <input
      data-outline-focus=""
      aria-label="Step title"
      value={draft}
      placeholder="What's the next small step?"
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => handlers.onEditKey(e, row, draft)}
      onBlur={() => handlers.onCommitTitle(step, draft)}
      className="w-full bg-transparent py-1 outline-none placeholder:text-muted-foreground/60"
    />
  );
}

function NotesField({ step, onSave }: { step: Step; onSave: (step: Step, notes: string) => void }) {
  const [value, setValue] = useState(step.notes ?? '');
  return (
    <textarea
      aria-label={`Notes for ${step.title || 'step'}`}
      value={value}
      rows={2}
      autoFocus
      placeholder="Notes, links, what 'done' means…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== (step.notes ?? '') && onSave(step, value)}
      className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    />
  );
}

export const StepRow = memo(StepRowImpl);
