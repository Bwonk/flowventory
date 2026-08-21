'use client';

import React, { useEffect, useState } from 'react';
import { useStockThreshold, DEFAULT_STOCK_THRESHOLD } from '@/lib/stock-threshold';
import { Dropdown } from '@/components/shared/filters/Dropdown';

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
      label={
        <span className="inline-flex items-center gap-1.5">
          Stok Eşiği
          {isActive && <span className="size-2 rounded-full bg-primary" />}
        </span>
      }
      align="end"
      panelClassName="!min-w-0 !p-0"
    >
      {close => (
        <div className="w-72 p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">STOK EŞİĞİ</p>

          <label className="mb-1 text-sm font-medium text-primary">Kritik seviye</label>
          <p className="mb-2 text-xs text-muted-foreground">Bu adet ve altı → Kritik (kırmızı)</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">{'≤'}</span>
            <input
              type="number"
              value={tempCritical}
              onChange={e => setTempCritical(e.target.value === '' ? 0 : Number(e.target.value))}
              className="w-20 rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">adet</span>
          </div>

          <div className="my-3 border-t border-muted" />

          <label className="mb-1 text-sm font-medium text-primary">Az kalan seviye</label>
          <p className="mb-2 text-xs text-muted-foreground">Bu adet ve altı → Az Kalan (sarı)</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">{'≤'}</span>
            <input
              type="number"
              value={tempWarning}
              onChange={e => setTempWarning(e.target.value === '' ? 0 : Number(e.target.value))}
              className="w-20 rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
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
                setThreshold({ min: tempCritical, max: tempWarning });
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
