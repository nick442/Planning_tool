import { create } from 'zustand';

export interface ToastOptions {
  message: string;
  /** "celebrate" for a finished branch. */
  tone?: 'default' | 'celebrate';
  action?: { label: string; run: () => void };
  /** Milliseconds before it disappears. */
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: number;
}

interface ToastState {
  toast: Toast | null;
}

export const useToastStore = create<ToastState>(() => ({ toast: null }));

let nextId = 1;

/** Shows a toast, replacing the current one. One at a time keeps things calm. */
export function showToast(options: ToastOptions): number {
  const id = nextId++;
  useToastStore.setState({ toast: { duration: 5000, ...options, id } });
  return id;
}

export function dismissToast(id?: number): void {
  const { toast } = useToastStore.getState();
  if (toast && (id === undefined || toast.id === id)) useToastStore.setState({ toast: null });
}
