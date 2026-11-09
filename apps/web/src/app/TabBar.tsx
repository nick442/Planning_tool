import { CircleCheckBig, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from './store';

/** Bottom tabs on phones: Goals (list → outline) and Done (Completed feed). */
export function TabBar({ doneToday }: { doneToday: number }) {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const selectGoal = useUiStore((s) => s.selectGoal);
  const selectedGoalId = useUiStore((s) => s.selectedGoalId);

  const tabs = [
    {
      id: 'goal' as const,
      label: 'Goals',
      icon: Target,
      // Tapping the active tab goes back to its first screen (the goal list).
      onClick: () => (view === 'goal' && selectedGoalId ? selectGoal(null) : setView('goal')),
    },
    {
      id: 'completed' as const,
      label: 'Done',
      icon: CircleCheckBig,
      badge: doneToday > 0 ? doneToday : undefined,
      onClick: () => setView('completed'),
    },
  ];

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-2">
        {tabs.map((tab) => {
          const active = view === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={tab.onClick}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-xs',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <tab.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="absolute left-1/2 top-1.5 ml-2 rounded-full bg-success px-1.5 text-[10px] font-medium leading-4 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
