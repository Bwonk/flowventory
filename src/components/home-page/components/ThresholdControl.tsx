'use client';

import React, { useEffect, useState } from 'react';
import { useStockThreshold, DEFAULT_STOCK_THRESHOLD } from '@/lib/stock-threshold';
import { Dropdown } from './Dropdown';

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
          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#17171c]" />}
        </span>
      }
      align="end"
      panelClassName="!min-w-0 !p-0"
    >
      {close => (
        <div className="w-72 p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#75758a]">STOK EŞİĞİ</p>

          <label className="mb-1 text-sm font-medium text-[#17171c]">Kritik seviye</label>
          <p className="mb-2 text-xs text-[#75758a]">Bu adet ve altı → Kritik (kırmızı)</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[#75758a]">{'≤'}</span>
            <input
              type="number"
              value={tempCritical}
              onChange={e => setTempCritical(e.target.value === '' ? 0 : Number(e.target.value))}
              className="w-20 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-sm outline-none focus:border-[#17171c] focus:ring-1 focus:ring-[#17171c]"
            />
            <span className="text-xs text-[#75758a]">adet</span>
          </div>

          <div className="my-3 border-t border-[#f3f4f6]" />

          <label className="mb-1 text-sm font-medium text-[#17171c]">Az kalan seviye</label>
          <p className="mb-2 text-xs text-[#75758a]">Bu adet ve altı → Az Kalan (sarı)</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[#75758a]">{'≤'}</span>
            <input
              type="number"
              value={tempWarning}
              onChange={e => setTempWarning(e.target.value === '' ? 0 : Number(e.target.value))}
              className="w-20 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-sm outline-none focus:border-[#17171c] focus:ring-1 focus:ring-[#17171c]"
            />
            <span className="text-xs text-[#75758a]">adet</span>
          </div>

          {hasError && (
            <p className="mb-2 text-xs text-[#b30000]">Kritik eşik, az kalan eşiğinden küçük olmalı</p>
          )}

          <div className="mt-3 border-t border-[#f3f4f6] pt-3">
            <p className="text-xs text-[#75758a]">Bu değerler dashboard ve listedeki renklendirmeyi belirler.</p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTempCritical(threshold.min);
                setTempWarning(threshold.max);
                close();
              }}
              className="flex-1 rounded-lg border border-[#e5e7eb] py-2 text-sm text-[#75758a] transition-colors hover:bg-[#f8f9fa]"
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
              className="flex-1 rounded-lg bg-[#17171c] py-2 text-sm font-medium text-white transition-colors hover:bg-[#212121] disabled:opacity-50"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  );
};
