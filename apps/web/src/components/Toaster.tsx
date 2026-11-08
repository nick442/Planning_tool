import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dismissToast, useToastStore } from './toast';

export function Toaster() {
  const toast = useToastStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div
      role="status"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
    >
      {toast && (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-2.5 text-sm shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
            toast.tone === 'celebrate' ? 'bg-success text-white' : 'bg-foreground text-background',
          )}
        >
          <span className="min-w-0 flex-1 truncate">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="shrink-0 font-semibold underline-offset-2 hover:underline"
              onClick={() => {
                toast.action!.run();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 opacity-70 hover:opacity-100"
            onClick={() => dismissToast(toast.id)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
