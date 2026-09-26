'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DeleteRuleDialogProps {
  ruleName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
}

/**
 * Kural silme onayı — geri alınamaz (rapor sayfasındaki DeleteVendorDialog
 * kalıbı). Tetikleyici dışarıda (tablo satır menüsü); dialog kontrollü.
 */
export function DeleteRuleDialog({ ruleName, open, onOpenChange, onConfirm }: DeleteRuleDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    const ok = await onConfirm();
    setDeleting(false);
    if (ok) {
      onOpenChange(false);
      toast.success(`Kural silindi: ${ruleName}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !deleting && onOpenChange(next)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kuralı sil</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{ruleName}</span> silinsin mi? Tetik geçmişi de silinir;
          zildeki eski bildirimler kalır. Bu işlem geri alınamaz.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" onClick={remove} disabled={deleting}>
            {deleting ? 'Siliniyor…' : 'Sil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
