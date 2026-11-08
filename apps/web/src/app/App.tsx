import { useMemo, useState } from 'react';
import { buildTree, goalProgress, type TreeNode } from '@planning/shared';
import { ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ProgressBar';
import { demoGoal, demoSteps } from './demoData';

function OutlineRow({ node }: { node: TreeNode }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className="flex items-center gap-2 rounded-md py-1 pr-2 hover:bg-accent"
        style={{ paddingLeft: `${node.depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen(!open)}
            className="text-muted-foreground"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <Circle className="size-4 text-muted-foreground" aria-hidden />
        )}
        <span className="flex-1">{node.step.title}</span>
        {!node.isLeaf && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(node.progress.ratio * 100)}%
          </span>
        )}
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <OutlineRow key={child.step.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function App() {
  const tree = useMemo(() => buildTree(demoSteps, demoGoal.id), []);
  const progress = useMemo(() => goalProgress(demoSteps, demoGoal.id), []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-6 space-y-3">
        <p className="text-sm text-muted-foreground">Planning Tool · setup preview</p>
        <h1 className="text-2xl font-semibold tracking-tight">{demoGoal.title}</h1>
        <div className="flex items-center gap-3">
          <ProgressBar value={progress.ratio} label={`${demoGoal.title} progress`} />
          <span className="text-sm tabular-nums text-muted-foreground">
            {Math.round(progress.ratio * 100)}%
          </span>
        </div>
      </header>
      <ul aria-label="Outline">
        {tree.map((node) => (
          <OutlineRow key={node.step.id} node={node} />
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="mt-4 text-muted-foreground" disabled>
        + Add step (coming in Milestone 2)
      </Button>
    </main>
  );
}
