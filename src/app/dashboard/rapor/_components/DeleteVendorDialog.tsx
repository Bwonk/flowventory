'use client';

import { logger } from '@/lib/logger';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { extractErrorMessage } from './QuickStockButton';

interface DeleteVendorDialogProps {
  token: string;
  vendorId: string;
  vendorName: string;
  /** Silme sonrası sayfa listesinden düşürme; tab mevcut fallback'le ilk tab'a döner. */
  onDeleted: (vendorId: string) => void;
}

/**
 * Ürünsüz tedarikçiyi silme akışı. ikas'ta vendor delete ucu yok; sunucu da
 * ürünlü tedarikçide 409 döner — bu yüzden buton yalnız boş tab'da gösterilir
 * (bkz. VendorTabsPanel). Geri alınamaz olduğundan onay adımı var.
 */
export function DeleteVendorDialog({ token, vendorId, vendorName, onDeleted }: DeleteVendorDialogProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await ApiRequests.vendors.delete(token, { vendorId });
      if (!res.data?.data) throw new Error('Empty vendor delete response');
      setOpen(false);
      toast.success(`Tedarikçi silindi: ${vendorName}`);
      onDeleted(vendorId);
    } catch (error) {
      logger.error('Vendor delete failed', { vendorId, error });
      toast.error(extractErrorMessage(error, 'Tedarikçi silinemedi.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !deleting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label={`${vendorName} tedarikçisini sil`}>
          <Trash2 className="size-3" aria-hidden />
          Tedarikçiyi Sil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tedarikçiyi sil</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{vendorName}</span> silinsin mi? Kayıtlı
          iletişim bilgileri de silinir; bu işlem geri alınamaz.
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
