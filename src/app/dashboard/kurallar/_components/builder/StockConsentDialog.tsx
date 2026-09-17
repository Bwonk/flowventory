'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MAX_STOCK_STEP } from '@/lib/rules/types';

interface StockConsentDialogProps {
  open: boolean;
  maxRunsPerDay: number;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Stok aksiyonu ilk kez kaydedilirken açık onay (K5). */
export function StockConsentDialog({ open, maxRunsPerDay, saving, onOpenChange, onConfirm }: StockConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stok otomatik değişecek</DialogTitle>
          <DialogDescription>Bu kural koşul sağlanınca ikas admin&apos;deki stoğa kendiliğinden yazar.</DialogDescription>
        </DialogHeader>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
          <li>Varyant başına günde en fazla {maxRunsPerDay} yazım; tek seferde en fazla +{MAX_STOCK_STEP.toLocaleString('tr-TR')} adet.</li>
          <li>Hedef, varyantın ilk deposudur.</li>
          <li>Her yazım zilde bildirim üretir ve kuralın geçmişinden geri alınabilir.</li>
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" onClick={onConfirm} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Onayla ve kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
