/**
 * Satın alma raporu — saf hesap fonksiyonları.
 *
 * Formül (brief):
 *   önerilenAdet = (günlükSatış × (hedefGün + leadTime) + emniyetStoğu) − mevcutStok
 *   → 5'in katına yukarı yuvarlanır.
 *
 * Emniyet stoğu (reorder point literatürü):
 *   emniyet = z × σ_günlük × √leadTime   (z = 1.65 ≈ %95 servis seviyesi)
 *   reorderPoint = günlükSatış × leadTime + emniyet
 *   Stok reorder point'in altındaysa sipariş "acil" işaretlenir.
 */

export const SERVICE_LEVEL_Z = 1.65;
export const ORDER_ROUNDING_MULTIPLE = 5;

/** n'i multiple'ın katına yukarı yuvarlar (0 ve altı → 0). */
export function roundUpToMultiple(n: number, multiple: number = ORDER_ROUNDING_MULTIPLE): number {
  if (n <= 0) return 0;
  return Math.ceil(n / multiple) * multiple;
}

/** Popülasyon standart sapması. */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface PurchaseLineInput {
  /** Pencere içindeki günlük satış adetleri (satışsız günler 0 olarak dahil). */
  dailyQuantities: number[];
  currentStock: number;
  leadTimeDays: number;
  targetStockDays: number;
}

export interface PurchaseLineComputation {
  /** Günlük ortalama satış (pencere ortalaması). */
  dailyAvg: number;
  /** Günlük satış standart sapması. */
  dailyStdDev: number;
  /** z × σ × √leadTime — talep dalgalanması tamponu. */
  safetyStock: number;
  /** Bu stok seviyesinin altı = sipariş zamanı geldi/geçti. */
  reorderPoint: number;
  /** 5'in katına yuvarlanmış önerilen sipariş adedi (0 = sipariş gerekmez). */
  suggestedQty: number;
  /** Stok reorder point'in altında mı? */
  urgent: boolean;
}

export function computePurchaseLine(input: PurchaseLineInput): PurchaseLineComputation {
  const { dailyQuantities, currentStock, leadTimeDays, targetStockDays } = input;

  const total = dailyQuantities.reduce((a, b) => a + b, 0);
  const dailyAvg = dailyQuantities.length > 0 ? total / dailyQuantities.length : 0;
  const dailyStdDev = stdDev(dailyQuantities);

  const safetyStock = Math.ceil(SERVICE_LEVEL_Z * dailyStdDev * Math.sqrt(Math.max(leadTimeDays, 0)));
  const reorderPoint = Math.ceil(dailyAvg * leadTimeDays + safetyStock);

  const targetLevel = dailyAvg * (targetStockDays + leadTimeDays) + safetyStock;
  const suggestedQty = roundUpToMultiple(Math.ceil(targetLevel - currentStock));

  return {
    dailyAvg,
    dailyStdDev,
    safetyStock,
    reorderPoint,
    suggestedQty,
    urgent: dailyAvg > 0 && currentStock <= reorderPoint,
  };
}
