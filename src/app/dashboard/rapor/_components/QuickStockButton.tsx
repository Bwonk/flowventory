'use client';

import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Check, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type QuickStockState = 'idle' | 'saving' | 'done';

interface QuickStockButtonProps {
  token: string;
  productId: string;
  variantId: string;
  /** Eklenecek adet — satırın sepetteki adedi, yoksa önerilen sipariş adedi. */
  addQty: number;
  /** Satırdaki Stok hücresini optimistic güncellemek için. */
  onStockChange: (variantId: string, newTotalStock: number) => void;
}

/** Sunucunun Türkçe hata mesajını çıkarır; yoksa genel kopya. */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const serverError = (error.response?.data as { error?: string } | undefined)?.error;
    if (serverError) return serverError;
  }
  return fallback;
}

/**
 * Tek tıkla stok girişi — sipariş akışının yanında ikincil bir kısayol:
 * satır hover'ında belirginleşir ve ikas admin'e yazdığı için doğrudan değil,
 * küçük bir onay popover'ı üzerinden çalışır. Onayda önerilen adet mevcut
 * stoğun üzerine eklenip ikas'a yazılır (sunucu canlı stok okur, bkz.
 * /api/ikas/quick-stock). Başarı toast'ındaki "Geri Al", önceki mutlak
 * değeri update-stock ile geri yazar.
 */
export function QuickStockButton({ token, productId, variantId, addQty, onStockChange }: QuickStockButtonProps) {
  const [state, setState] = useState<QuickStockState>('idle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  const applyStock = async () => {
    setConfirmOpen(false);
    setState('saving');
    try {
      const res = await ApiRequests.ikas.quickStock(token, { productId, variantId, addQty });
      const data = res.data?.data;
      if (!data) throw new Error('Empty quick-stock response');

      onStockChange(variantId, data.newTotalStock);
      setState('done');
      doneTimer.current = setTimeout(() => setState('idle'), 1500);

      const undo = async () => {
        try {
          await ApiRequests.ikas.updateStock(token, {
            productId,
            variantId,
            stockLocationId: data.stockLocationId,
            stockCount: data.previousCount,
          });
          onStockChange(variantId, data.newTotalStock - addQty);
          toast.success('Geri alındı');
        } catch (error) {
          logger.error('Quick stock undo failed', { variantId, error });
          toast.error('Geri alınamadı.');
        }
      };

      toast.success(`Stok girildi: ${addQty}`, { action: { label: 'Geri Al', onClick: undo } });
    } catch (error) {
      logger.error('Quick stock failed', { variantId, error });
      setState('idle');
      toast.error(extractErrorMessage(error, 'Stok girilemedi.'));
    }
  };

  return (
    <Popover open={confirmOpen} onOpenChange={next => state === 'idle' && setConfirmOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={state !== 'idle'}
          aria-label={`${addQty} adet stok gir`}
          // Sipariş akışı asıl yol — bu kısayol satır hover'ında belirginleşir;
          // saving/done geri bildirimleri soluklaşmadan muaf.
          className={cn(
            'h-6 gap-1 px-2 text-xs text-muted-foreground transition-opacity duration-150 hover:text-foreground',
            state === 'idle' && !confirmOpen && 'opacity-60 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          {state === 'saving' ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : state === 'done' ? (
            <Check className="size-3 text-status-healthy" aria-hidden />
          ) : (
            <Plus className="size-3" aria-hidden />
          )}
          Stok
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-sm text-foreground">
          İkas admin&apos;deki stok da güncellenir:{' '}
          <span className="font-semibold tabular-nums">+{addQty} adet</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bu işlem sipariş göndermez; mağaza stoğuna anında yazar.
        </p>
        <div className="mt-3 flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setConfirmOpen(false)}
          >
            Vazgeç
          </Button>
          <Button size="sm" className="h-6 px-2 text-xs" onClick={applyStock}>
            Onayla
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
