import { useState, type FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { RefreshCw } from 'lucide-react';
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
import { getToken, setToken, useSyncStore, type SyncStatus } from './engine';
import { syncEngine } from './index';

const plural = (n: number) => `${n} change${n === 1 ? '' : 's'}`;

function describe(status: SyncStatus, pending: number): { label: string; dot: string } {
  switch (status) {
    case 'syncing':
      return { label: 'Syncing…', dot: 'bg-sky-500 animate-pulse' };
    case 'offline':
      return {
        label: pending > 0 ? `Offline · ${plural(pending)} waiting` : 'Offline',
        dot: 'bg-muted-foreground/50',
      };
    case 'unauthorized':
      return { label: 'Enter sync token', dot: 'bg-amber-500' };
    case 'error':
      return { label: 'Sync problem', dot: 'bg-destructive' };
    default:
      return pending > 0
        ? { label: `${plural(pending)} to sync`, dot: 'bg-sky-500' }
        : { label: 'Synced', dot: 'bg-success' };
  }
}

/** Small status line: synced, syncing or offline (with pending changes). Click for details. */
export function SyncIndicator({ className }: { className?: string }) {
  const { status, pending } = useSyncStore();
  const [open, setOpen] = useState(false);
  const { label, dot } = describe(status, pending);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent',
          className,
        )}
        aria-label={`Sync: ${label}`}
      >
        <span aria-hidden className={cn('size-2 rounded-full', dot)} />
        {label}
      </button>
      <SyncDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function SyncDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { status, pending, lastSyncedAt, error, live } = useSyncStore();
  const [token, setTokenValue] = useState(() => getToken() ?? '');

  const save = (event: FormEvent) => {
    event.preventDefault();
    setToken(token.trim() || null);
    void syncEngine.syncNow();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Sync</DialogTitle>
            <DialogDescription>
              Changes are saved on this device first and synced with your Mac mini whenever it can
              be reached.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{describe(status, pending).label}</dd>
            <dt className="text-muted-foreground">Waiting to sync</dt>
            <dd>{pending === 0 ? 'Nothing' : plural(pending)}</dd>
            <dt className="text-muted-foreground">Last synced</dt>
            <dd>
              {lastSyncedAt ? format(parseISO(lastSyncedAt), 'EEE d MMM, HH:mm:ss') : 'Not yet'}
            </dd>
            <dt className="text-muted-foreground">Live updates</dt>
            <dd>{live ? 'Connected' : 'Not connected'}</dd>
            {error && (
              <>
                <dt className="text-muted-foreground">Problem</dt>
                <dd>{error}</dd>
              </>
            )}
          </dl>

          <div className="grid gap-2">
            <Label htmlFor="sync-token">Access token</Label>
            <Input
              id="sync-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Only if the server asks for one"
            />
          </div>

          <DialogFooter>
            <Button type="submit">
              <RefreshCw /> Save and sync now
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
