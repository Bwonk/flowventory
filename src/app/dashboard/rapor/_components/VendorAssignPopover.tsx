'use client';

import { logger } from '@/lib/logger';
import { useState } from 'react';
import { Loader2, Plus, Store } from 'lucide-react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import type { VendorListItem } from '@/app/api/vendors/route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OptionButton } from '@/components/shared/filters/Dropdown';
import { extractErrorMessage } from './QuickStockButton';

interface VendorAssignPopoverProps {
  token: string;
  productId: string;
  vendors: VendorListItem[];
  /** Atama sonrası sayfa seviyesinde rapor refetch'i (satırlar grup değiştirir). */
  onAssigned: () => Promise<void>;
}

/**
 * "Tedarikçi atanmamış" grubundaki satırlar için tedarikçi atama popover'ı.
 * Mevcut tedarikçiler aranabilir listede; eşleşme yoksa yazılan ad yeni
 * tedarikçi olarak atanır (ikas isimle bulur/oluşturur). Tedarikçi ürün
 * seviyesindedir — atama ürünün tüm varyant satırlarını taşır.
 */
export function VendorAssignPopover({ token, productId, vendors, onAssigned }: VendorAssignPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = query.trim();
  const lowered = trimmed.toLocaleLowerCase('tr');
  const filtered = trimmed
    ? vendors.filter(v => v.vendorName.toLocaleLowerCase('tr').includes(lowered))
    : vendors;
  const hasExactMatch = vendors.some(v => v.vendorName.toLocaleLowerCase('tr') === lowered);

  const assign = async (vendorName: string) => {
    setSaving(true);
    try {
      const res = await ApiRequests.ikas.assignVendor(token, { productId, vendorName });
      const data = res.data?.data;
      if (!data) throw new Error('Empty assign-vendor response');
      setOpen(false);
      setQuery('');
      toast.success(`Tedarikçi atandı: ${data.vendorName}`);
      await onAssigned();
    } catch (error) {
      logger.error('Vendor assign failed', { productId, error });
      toast.error(extractErrorMessage(error, 'Tedarikçi atanamadı.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (saving) return;
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" aria-label="Tedarikçi ata">
          <Store className="size-3" aria-hidden />
          Tedarikçi
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="z-[100] w-64 rounded-lg p-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Tedarikçi ara veya ekle…"
          className="h-8 text-sm"
          disabled={saving}
        />
        <div className="mt-1.5 max-h-56 overflow-y-auto">
          {filtered.map(v => (
            <OptionButton
              key={v.vendorId}
              label={v.vendorName}
              selected={false}
              onClick={() => {
                if (!saving) assign(v.vendorName);
              }}
            />
          ))}
          {trimmed && !hasExactMatch && (
            <button
              type="button"
              disabled={saving}
              onClick={() => assign(trimmed)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              {saving ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4 shrink-0" aria-hidden />
              )}
              <span className="truncate">&quot;{trimmed}&quot; olarak ekle</span>
            </button>
          )}
          {!trimmed && vendors.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Tedarikçi yok — ad yazıp ekleyin.</p>
          )}
        </div>
        <p className="mt-1.5 border-t border-hairline px-1 pt-2 text-xs text-muted-foreground">
          Ürünün tüm varyantlarına uygulanır.
        </p>
      </PopoverContent>
    </Popover>
  );
}
