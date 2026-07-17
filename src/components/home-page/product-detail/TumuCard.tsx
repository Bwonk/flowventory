'use client';

import React from 'react';
import { formatPrice } from '../lib/format';

function formatStockLifetime(days: number | null, total: number): { label: string; tone: 'default' | 'neutral' | 'critical' } {
  if (total === 0) return { label: 'Tükendi', tone: 'critical' };
  if (days == null) return { label: 'Veri yok', tone: 'neutral' };
  if (days >= 365) {
    const years = (days / 365).toFixed(1).replace('.', ',');
    return { label: `${years} yıl`, tone: 'default' };
  }
  return { label: `${days} gün`, tone: 'default' };
}

const toneClass: Record<string, string> = {
  critical: 'text-destructive',
  neutral: 'text-muted-foreground',
  default: 'text-foreground',
};

const cellClasses = 'flex flex-col gap-0.5 border-r border-border last:border-r-0 px-4 py-3';

export const ProductKpiRow: React.FC<{
  totalStock: number;
  productRevenue: number;
  totalViews?: number;
  daysRemaining?: number | null;
}> = ({ totalStock, productRevenue, totalViews, daysRemaining }) => {
  const lifetime = formatStockLifetime(daysRemaining ?? null, totalStock);

  return (
    <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
      <div className={cellClasses}>
        <span className="text-xs text-muted-foreground">Toplam Stok</span>
        <span className="text-xl font-semibold text-foreground sm:text-2xl">{totalStock}</span>
        <span className="text-xs text-muted-foreground">adet</span>
      </div>
      <div className={cellClasses}>
        <span className="text-xs text-muted-foreground">30 Günlük Ciro</span>
        <span className="text-xl font-semibold text-foreground sm:text-2xl">{formatPrice(productRevenue)}</span>
      </div>
      <div className={cellClasses}>
        <span className="text-xs text-muted-foreground">30 Günlük Görüntülenme</span>
        <span className="text-xl font-semibold text-foreground sm:text-2xl">{totalViews ?? '—'}</span>
        <span className="text-xs text-muted-foreground">{totalViews == null ? 'Veri yok' : 'görüntülenme'}</span>
      </div>
      <div className={cellClasses}>
        <span className="text-xs text-muted-foreground">Tahmini Stok Ömrü</span>
        <span className={`text-xl font-semibold sm:text-2xl ${toneClass[lifetime.tone]}`}>{lifetime.label}</span>
        {lifetime.tone === 'default' && <span className="text-xs text-muted-foreground">tahmini</span>}
      </div>
    </div>
  );
};
