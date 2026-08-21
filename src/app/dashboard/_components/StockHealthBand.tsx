'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, Package } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import type { SkuHealth } from '../lib/metrics';

type SegmentKey = 'healthy' | 'warning' | 'critical';

interface StockHealthBandProps {
  skuHealth: SkuHealth;
  /** Ürün verisi alınamadı — retry'lı boş durum gösterilir. */
  error?: boolean;
  onRetry?: () => void;
  /** Panel giriş animasyonu sırası (animate-enter). */
  stagger?: number;
}

function formatPct(pct: number): string {
  return `%${pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

/**
 * Metrik panelinin alt bandı: SKU stok sağlığı metresi + kompakt inline legend.
 * Metre segmentleri ilk boyamada spring'le açılır; legend hover'ı ilgili
 * segmenti vurgular (diğerleri söner) — renk-üstü ikinci sinyal.
 */
export function StockHealthBand({ skuHealth, error, onRetry, stagger }: StockHealthBandProps) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState<SegmentKey | null>(null);

  const items: Array<{
    key: SegmentKey;
    dot: string;
    label: string;
    count: number;
    pct: number;
  }> = [
    { key: 'healthy', dot: 'bg-status-healthy', label: 'Sağlıklı', count: skuHealth.healthy, pct: skuHealth.segments.healthy },
    { key: 'warning', dot: 'bg-status-warning', label: 'Az Kalan', count: skuHealth.warning, pct: skuHealth.segments.warning },
    { key: 'critical', dot: 'bg-status-critical', label: 'Tükendi', count: skuHealth.critical, pct: skuHealth.segments.critical },
  ];
  const segments = items.filter(s => s.count > 0);

  const staggerStyle = stagger != null ? ({ '--stagger': stagger } as CSSProperties) : undefined;

  return (
    <div
      style={staggerStyle}
      className={cn('border-t border-border p-5', stagger != null && 'animate-enter')}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            STOK SAĞLIĞI · {skuHealth.total} SKU
          </p>
        </div>
        {!error && skuHealth.total > 0 && (
          <Link
            href="/dashboard/stok"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Tüm stokları görüntüle
            <span>&rarr;</span>
          </Link>
        )}
      </div>

      {error ? (
        <EmptyState
          icon={AlertTriangle}
          message="Ürün verisi alınamadı."
          actionLabel={onRetry ? 'Tekrar dene' : undefined}
          onAction={onRetry}
        />
      ) : skuHealth.total === 0 ? (
        <EmptyState icon={Package} message="Henüz ürün bulunmuyor." />
      ) : (
        <>
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Sağlıklı ${skuHealth.healthy}, Az kalan ${skuHealth.warning}, Tükendi ${skuHealth.critical}`}
          >
            {segments.map((s, i) => (
              <motion.div
                key={s.key}
                className={cn(
                  s.dot,
                  'transition-opacity duration-150',
                  hovered && hovered !== s.key && 'opacity-35',
                )}
                initial={reduceMotion ? { width: `${s.pct}%` } : { width: 0 }}
                animate={{ width: `${s.pct}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.8, delay: reduceMotion ? 0 : 0.12 * i }}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            {items.map(item => (
              <div
                key={item.key}
                onMouseEnter={item.count > 0 ? () => setHovered(item.key) : undefined}
                onMouseLeave={item.count > 0 ? () => setHovered(null) : undefined}
                className="flex items-center gap-2"
              >
                <span className={`size-2 rounded-full ${item.dot}`} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="font-mono text-sm font-medium tabular-nums text-foreground">{item.count}</span>
                <span className="text-xs text-muted-foreground">SKU · {formatPct(item.pct)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
