'use client';

import Link from 'next/link';
import type { InventoryInsightItem } from '@/app/api/insights/inventory/route';
import { ProductThumb } from '@/components/shared/filters/atoms';
import { formatPrice } from '@/lib/currency';
import { ACTION_ORDER, overstockExcessValue, type ActionKey } from '@/lib/reports/actions';
import { ACTION_LABELS } from './constants';

interface ActionPanelProps {
  items: InventoryInsightItem[];
  actionByProduct: Map<string, ActionKey | null>;
  targetStockDays: number;
  windowDays: number;
  selected: ActionKey | 'all';
  onSelect: (action: ActionKey) => void;
}

const ACTION_DOT: Record<ActionKey, string> = {
  'siparis-ver': 'bg-status-critical',
  'eritme-adayi': 'bg-status-warning',
  'fazla-stok': 'bg-muted-foreground/40',
};

interface QueueSummary {
  key: ActionKey;
  description: string;
  members: InventoryInsightItem[];
  /** Kuyruğa göre anlamı değişen para tutarı (riskteki ciro / bağlı sermaye / fazla sermaye). */
  amount: number;
  amountLabel: string;
  hasEstimate: boolean;
}

/**
 * "Bugün ne yapmalı?" — sinyalleri (ABC × yaşlandırma × tükeniş) üç sade
 * kuyruğa indirger. Üyelik deriveAction'dan gelir; kart tıklaması tabloyu
 * aynı kurala göre filtreler, bu yüzden sayılar hiçbir zaman çelişmez.
 */
export function ActionPanel({ items, actionByProduct, targetStockDays, windowDays, selected, onSelect }: ActionPanelProps) {
  const queues: QueueSummary[] = ACTION_ORDER.map(key => {
    const members = items.filter(i => actionByProduct.get(i.productId) === key);
    switch (key) {
      case 'siparis-ver':
        return {
          key,
          description: 'Çok satan (A/B) ürünler tedarik süresi dolmadan tükeniyor',
          members: [...members].sort((a, b) => b.revenue - a.revenue),
          amount: members.reduce((s, i) => s + i.revenue, 0),
          amountLabel: `riskte · son ${windowDays}g cirosu`,
          hasEstimate: false,
        };
      case 'eritme-adayi':
        return {
          key,
          description: 'C sınıfı, 6+ ay yetecek ya da hiç satmayan stok — indirim veya paket düşün',
          members: [...members].sort((a, b) => b.stockValue - a.stockValue),
          amount: members.reduce((s, i) => s + i.stockValue, 0),
          amountLabel: 'bağlı sermaye',
          hasEstimate: members.some(i => i.isEstimate),
        };
      case 'fazla-stok':
      default:
        return {
          key,
          description: `Satışı sürüyor ama stok hedefin (${targetStockDays} gün) 3 katından uzun yetiyor`,
          members: [...members].sort(
            (a, b) =>
              overstockExcessValue(b.stockValue, b.daysOfStock ?? 0, targetStockDays) -
              overstockExcessValue(a.stockValue, a.daysOfStock ?? 0, targetStockDays),
          ),
          amount: members.reduce(
            (s, i) => s + overstockExcessValue(i.stockValue, i.daysOfStock ?? 0, targetStockDays),
            0,
          ),
          amountLabel: 'hedef üstü bağlı sermaye',
          hasEstimate: members.some(i => i.isEstimate),
        };
    }
  });

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-hairline bg-card">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">Bugün ne yapmalı?</h2>
        <p className="text-xs text-muted-foreground">
          ABC, satış hızı ve yaşlandırma sinyallerinden türetilen aksiyon listesi
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3">
        {queues.map(queue => {
          const isSelected = selected === queue.key;
          const isEmpty = queue.members.length === 0;
          return (
            <div
              key={queue.key}
              className="flex flex-col border-b border-r border-border p-5 last:border-b-0 md:border-b-0 md:last:border-r-0"
            >
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${ACTION_DOT[queue.key]}`} />
                {ACTION_LABELS[queue.key]}
              </p>

              {isEmpty ? (
                <p className="mt-3 text-xs text-muted-foreground">Temiz — şu an aksiyon gerektiren ürün yok.</p>
              ) : (
                <>
                  <p className="mt-3 font-mono text-xl font-medium tabular-nums xl:text-2xl text-foreground">
                    {queue.members.length} ürün
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPrice(queue.amount)}
                    {queue.hasEstimate ? '~' : ''} {queue.amountLabel}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{queue.description}</p>

                  <ul className="mt-3 space-y-1.5 rounded-lg bg-muted p-3">
                    {queue.members.slice(0, 3).map(item => (
                      <li key={item.productId} className="flex items-center gap-2 text-xs">
                        <ProductThumb src={item.imageUrl ?? undefined} alt="" sizeClass="h-6 w-6" />
                        <span className="min-w-0 flex-1 truncate text-foreground">{item.productName}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {queue.key === 'siparis-ver' ? formatPrice(item.revenue) : formatPrice(item.stockValue)}
                        </span>
                      </li>
                    ))}
                    {queue.members.length > 3 && (
                      <li className="text-[11px] text-muted-foreground">+{queue.members.length - 3} ürün daha</li>
                    )}
                  </ul>

                  <div className="mt-auto flex items-center gap-4 pt-3">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(queue.key)}
                      className={`text-xs font-medium underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected ? 'text-foreground underline' : 'text-foreground hover:underline'
                      }`}
                    >
                      {isSelected ? 'Filtreyi kaldır' : 'Listeyi gör ↓'}
                    </button>
                    {queue.key === 'siparis-ver' && (
                      <Link
                        href="/dashboard/rapor"
                        className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Sipariş önerisi →
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
