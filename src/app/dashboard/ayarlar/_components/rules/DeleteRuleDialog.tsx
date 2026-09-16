'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DeleteRuleDialogProps {
  ruleName: string;
  onConfirm: () => Promise<boolean>;
}

/** Kural silme onayı — geri alınamaz (rapor sayfasındaki DeleteVendorDialog kalıbı). */
export function DeleteRuleDialog({ ruleName, onConfirm }: DeleteRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    const ok = await onConfirm();
    setDeleting(false);
    if (ok) {
      setOpen(false);
      toast.success(`Kural silindi: ${ruleName}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !deleting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={`${ruleName} kuralını sil`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kuralı sil</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{ruleName}</span> silinsin mi? Bu kuralın ürettiği
          eski bildirimler kalır; bu işlem geri alınamaz.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={remove} disabled={deleting}>
            {deleting ? 'Siliniyor…' : 'Sil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
