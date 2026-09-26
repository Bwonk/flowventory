'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useStockThreshold, DEFAULT_STOCK_THRESHOLD } from '@/lib/stock-threshold';
import { Dropdown } from '@/components/shared/filters/Dropdown';
import { NumberStepper } from '@/components/shared/NumberStepper';

/**
 * Stok eşiği kontrolü: tetikleyici dropdown + geçici (temp) kritik/az kalan girişleri.
 * Eşik değerini doğrudan useStockThreshold üzerinden okur/yazar; dışarıdan prop almaz.
 */
export const ThresholdControl: React.FC = () => {
  const { threshold, setThreshold } = useStockThreshold();

  const [tempCritical, setTempCritical] = useState(DEFAULT_STOCK_THRESHOLD.min);
  const [tempWarning, setTempWarning] = useState(DEFAULT_STOCK_THRESHOLD.max);

  useEffect(() => {
    setTempCritical(threshold.min);
    setTempWarning(threshold.max);
  }, [threshold.min, threshold.max]);

  const isActive =
    threshold.min !== DEFAULT_STOCK_THRESHOLD.min || threshold.max !== DEFAULT_STOCK_THRESHOLD.max;
  const hasError = tempCritical >= tempWarning;

  return (
    <Dropdown
      variant="segment"
      label="Stok Eşiği"
      active={isActive}
      // Panelde tik yok — Uygula/Sıfırla anında kapatır.
      closeDelay={0}
      align="end"
      panelClassName="!min-w-0 !p-0"
    >
      {close => (
        <div className="w-72 p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">STOK EŞİĞİ</p>

          <p className="mb-1 text-sm font-medium text-primary">Kritik seviye</p>
          <p className="mb-2 text-xs text-muted-foreground">Bu adet ve altı → Kritik (kırmızı)</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">{'≤'}</span>
            <NumberStepper min={0} max={9999} value={tempCritical} label="Kritik seviye" onChange={setTempCritical} />
            <span className="text-xs text-muted-foreground">adet</span>
          </div>

          <div className="my-3 border-t border-muted" />

          <p className="mb-1 text-sm font-medium text-primary">Az kalan seviye</p>
          <p className="mb-2 text-xs text-muted-foreground">Bu adet ve altı → Az Kalan (sarı)</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">{'≤'}</span>
            <NumberStepper min={0} max={9999} value={tempWarning} label="Az kalan seviye" onChange={setTempWarning} />
            <span className="text-xs text-muted-foreground">adet</span>
          </div>

          {hasError && (
            <p className="mb-2 text-xs text-destructive">Kritik eşik, az kalan eşiğinden küçük olmalı</p>
          )}

          <div className="mt-3 border-t border-muted pt-3">
            <p className="text-xs text-muted-foreground">Bu değerler dashboard ve listedeki renklendirmeyi belirler.</p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTempCritical(threshold.min);
                setTempWarning(threshold.max);
                close();
              }}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={() => {
                // İyimser uygulanır, panel hemen kapanır; sunucu yazamazsa eşik geri döner.
                void setThreshold({ min: tempCritical, max: tempWarning }).then(ok => {
                  if (!ok) toast.error('Stok eşiği kaydedilemedi, önceki değere dönüldü. Tekrar deneyin.');
                });
                close();
              }}
              disabled={hasError}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-foreground disabled:opacity-50"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  );
};
