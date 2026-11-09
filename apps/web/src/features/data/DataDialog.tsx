import { useRef, useState } from 'react';
import { Download, HardDrive, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadExport, importFile, ImportError } from './transfer';

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** "Your data": JSON export and import. */
export function DataButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <HardDrive /> Export / import
      </Button>
      <DataDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function DataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const plan = await importFile(file);
      setMessage({
        kind: 'ok',
        text:
          plan.added + plan.updated === 0
            ? `Nothing new: all ${plan.unchanged} records were already up to date.`
            : `Imported ${plan.added} new and ${plan.updated} updated records` +
              (plan.unchanged ? ` (${plan.unchanged} already up to date).` : '.'),
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof ImportError ? error.message : `Import failed: ${String(error)}`,
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setMessage(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your data</DialogTitle>
          <DialogDescription>
            Everything is stored on this device and on your Mac mini, which also keeps a backup
            every night. You can save your own copy as a JSON file, or load one back in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Button onClick={downloadExport}>
            <Download /> Download JSON export
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            <Upload /> {busy ? 'Importing…' : 'Import JSON file…'}
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            aria-label="Export file to import"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Importing merges: for anything that exists in both places, the most recently changed
          version wins, so an old file never overwrites newer work.
        </p>

        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={
              message.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-success'
            }
          >
            {message.text}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
