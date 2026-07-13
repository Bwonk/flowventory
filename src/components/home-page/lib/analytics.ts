import type { ChartRange, DaySeriesPoint, Product, TopProduct } from '../types';
import { TR_MONTHS } from '../constants';
import { formatDayMonth } from './format';

/** Günlük seriyi seçili zaman aralığına göre gruplar (kronolojik sırayla). */
export function groupSeries(
  series: DaySeriesPoint[],
  range: ChartRange,
): Array<{ label: string; revenue: number; units: number; views: number }> {
  if (range === 'daily') {
    return series.map(s => ({ label: formatDayMonth(s.date), revenue: s.revenue, units: s.units, views: s.views }));
  }
  const map = new Map<string, { label: string; revenue: number; units: number; views: number; order: number }>();
  for (const s of series) {
    const d = new Date(s.date);
    if (Number.isNaN(d.getTime())) continue;
    let key: string;
    let label: string;
    let order: number;
    if (range === 'weekly') {
      const weekday = (d.getDay() + 6) % 7;
      const start = new Date(d);
      start.setDate(d.getDate() - weekday);
      key = start.toISOString().slice(0, 10);
      label = formatDayMonth(key);
      order = start.getTime();
    } else if (range === 'monthly') {
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = `${TR_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      order = d.getFullYear() * 12 + d.getMonth();
    } else {
      key = `${d.getFullYear()}`;
      label = key;
      order = d.getFullYear();
    }
    const existing = map.get(key) ?? { label, revenue: 0, units: 0, views: 0, order };
    existing.revenue += s.revenue;
    existing.units += s.units;
    existing.views += s.views;
    map.set(key, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map(({ label, revenue, units, views }) => ({ label, revenue, units, views }));
}

/** Bu ürüne ait varyantların 30 günlük toplam cirosu. */
export function getProductRevenue(product: Product, topProducts: TopProduct[]): number {
  return topProducts
    .filter(p => product.variants.some(v => v.id === p.variantId))
    .reduce((sum, p) => sum + p.revenue, 0);
}

/** Bu ürüne ait varyantların 30 günlük toplam satış adedi. */
export function getProductQuantity(product: Product, topProducts: TopProduct[]): number {
  return topProducts
    .filter(p => product.variants.some(v => v.id === p.variantId))
    .reduce((sum, p) => sum + p.quantity, 0);
}

export function getVariantRevenue(variantId: string, topProducts: TopProduct[]): number {
  return topProducts.find(p => p.variantId === variantId)?.revenue ?? 0;
}

export function getVariantQuantity(variantId: string, topProducts: TopProduct[]): number {
  return topProducts.find(p => p.variantId === variantId)?.quantity ?? 0;
}
