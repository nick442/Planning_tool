import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { settle, useConfirmStore } from './confirm';

export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && settle(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          {request?.description && <DialogDescription>{request.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            Cancel
          </Button>
          <Button
            autoFocus
            variant={request?.destructive ? 'destructive' : 'default'}
            onClick={() => settle(true)}
          >
            {request?.confirmLabel ?? 'OK'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
