import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';

type ProductLike = {
  name: string;
  variants: Array<{
    id: string;
    sku?: string | null;
    prices?: Array<{ sellPrice?: number | null }> | null;
  }>;
};

/**
 * Development-only: sipariş yokken chart'ları dolduran sentetik analytics.
 * createOrderWithTransactions bu app tipinde (admin app) engelli:
 * error_messages.order.app_is_not_a_sales_channel
 */
export function buildMockAnalytics(products: ProductLike[]): AnalyticsApiResponse {
  const variants = products.flatMap(p =>
    (p.variants ?? [])
      .filter(v => v.id)
      .map(v => ({
        variantId: v.id,
        sku: v.sku || v.id,
        sellPrice: v.prices?.[0]?.sellPrice || 100,
        name: p.name,
      })),
  );

  const pool =
    variants.length > 0
      ? variants
      : [
          { variantId: 'seed-variant-1', sku: 'SEED-1', sellPrice: 499, name: 'Seed' },
          { variantId: 'seed-variant-2', sku: 'SEED-2', sellPrice: 299, name: 'Seed' },
          { variantId: 'seed-variant-3', sku: 'SEED-3', sellPrice: 799, name: 'Seed' },
        ];

  const dailyRevenue: AnalyticsApiResponse['dailyRevenue'] = [];
  const productMap = new Map<string, { sku: string; revenue: number; quantity: number }>();
  let totalRevenue = 0;

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = d.toISOString().split('T')[0];

    // Hafta sonu daha düşük, hafta içi dalgalı ciro
    const weekday = d.getDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.55 : 1;
    const wave = 0.7 + 0.3 * Math.sin(i / 3);
    let dayRevenue = 0;

    const salesToday = 2 + ((i * 3) % 5);
    for (let s = 0; s < salesToday; s++) {
      const v = pool[(i + s) % pool.length];
      const qty = 1 + ((i + s) % 3);
      const line = Math.round(v.sellPrice * qty * weekendFactor * wave * 100) / 100;
      dayRevenue += line;

      const existing = productMap.get(v.variantId) || { sku: v.sku, revenue: 0, quantity: 0 };
      existing.revenue += line;
      existing.quantity += qty;
      productMap.set(v.variantId, existing);
    }

    dayRevenue = Math.round(dayRevenue * 100) / 100;
    totalRevenue += dayRevenue;
    dailyRevenue.push({ date, revenue: dayRevenue });
  }

  // Önceki 30 güne göre ~+12% değişim hissi
  const revenueChange = 12;

  // TAM liste — gerçek endpoint ile aynı sözleşme (top-N kesintisi yok).
  const salesByVariant = Array.from(productMap.entries())
    .map(([variantId, data]) => ({
      variantId,
      sku: data.sku,
      revenue: Math.round(data.revenue * 100) / 100,
      quantity: data.quantity,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    revenueChange,
    dailyRevenue,
    salesByVariant,
  };
}

export function buildMockHourlyAnalytics(date: string): Array<{
  hour: number;
  label: string;
  revenue: number;
  quantity: number;
}> {
  return Array.from({ length: 24 }, (_, hour) => {
    const isOpen = hour >= 9 && hour <= 22;
    const peak = hour >= 12 && hour <= 14 || hour >= 19 && hour <= 21;
    const quantity = isOpen ? (peak ? 4 + (hour % 3) : 1 + (hour % 2)) : 0;
    const revenue = Math.round(quantity * (180 + hour * 7) * 100) / 100;
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      revenue: isOpen ? revenue : 0,
      quantity,
    };
  });
}
