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

/**
 * Stoklu gün maskesi: günün başında stok ≤ 0 olan ve o gün satış yapılmamış
 * günler talebi değil stoksuzluğu gösterir; ortalamaya girerse talep olduğundan
 * düşük görünür. Geçmiş kaydı olmayan günler (bilinmiyor) dahil sayılır.
 *
 * @param dayKeys pencere gün anahtarları (eskiden yeniye)
 * @param history stok değişim kayıtları, `dateKey` artan sırada
 * @param dailyQuantities `dayKeys` ile hizalı günlük satışlar
 */
export function buildInStockMask(
  dayKeys: string[],
  history: ReadonlyArray<{ dateKey: string; totalStock: number }>,
  dailyQuantities: number[],
): boolean[] {
  let cursor = 0;
  let carry: number | null = null;
  // Pencereden önceki son değer günün başlangıç stoğudur.
  while (cursor < history.length && history[cursor].dateKey < dayKeys[0]) {
    carry = history[cursor].totalStock;
    cursor++;
  }
  return dayKeys.map((key, i) => {
    const startStock = carry;
    while (cursor < history.length && history[cursor].dateKey === key) {
      carry = history[cursor].totalStock;
      cursor++;
    }
    const outOfStock = startStock !== null && startStock <= 0 && (dailyQuantities[i] ?? 0) === 0;
    return !outOfStock;
  });
}

export interface ReplenishmentInput extends PurchaseLineInput {
  /** Gönderilmiş siparişlerde henüz gelmemiş adet. */
  incoming: number;
  /** En az sipariş adedi; boşsa sınır yok. */
  moq: number | null;
  /** Koli adedi; boşsa ORDER_ROUNDING_MULTIPLE. */
  casePack: number | null;
  /** `dailyQuantities` ile hizalı stoklu gün maskesi; verilmezse tüm günler. */
  inStockMask?: boolean[];
}

export interface Replenishment extends PurchaseLineComputation {
  incoming: number;
  /** Yuvarlanmamış ihtiyaç (≥ 0): hedef seviye − stok − yolda. */
  rawQty: number;
  /** Sipariş noktasına inildiyse MOQ ve koliye yuvarlanmış adet, değilse 0. */
  suggestedQty: number;
  /** Stok + yolda ≤ sipariş noktası (satış varken). */
  needsOrder: boolean;
  /** Stok + yolda, tedarik süresi boyunca satışı karşılamıyor. */
  urgent: boolean;
  /** Eldeki stok kaç gün yeter (satış yoksa null). */
  daysOfCover: number | null;
  /** En geç sipariş: (stok + yolda) kapsaması − tedarik süresi; ≤ 0 = bugün/gecikti. */
  orderInDays: number | null;
  /** Ortalamaya giren gün sayısı. */
  inStockDays: number;
}

/**
 * Sektör ikmal formülü (Inventory Planner / Prediko / Katana ortak kalıbı):
 *   ihtiyaç = günlük × (tedarik + hedef gün) + emniyet − stok − yolda
 *   adet    = yukarı yuvarla(max(ihtiyaç, MOQ), koli)
 * Öneri stok + yolda sipariş noktasına inince başlar; günlük ortalama
 * yalnız stoklu günlerden alınır.
 */
export function computeReplenishment(input: ReplenishmentInput): Replenishment {
  const { dailyQuantities, inStockMask, currentStock, incoming, leadTimeDays, targetStockDays, moq, casePack } = input;
  const inStock = inStockMask ? dailyQuantities.filter((_, i) => inStockMask[i] !== false) : dailyQuantities;
  const base = computePurchaseLine({ dailyQuantities: inStock, currentStock, leadTimeDays, targetStockDays });

  const position = currentStock + incoming;
  const targetLevel = base.dailyAvg * (targetStockDays + leadTimeDays) + base.safetyStock;
  const rawQty = Math.max(0, Math.ceil(targetLevel - position));
  const needsOrder = base.dailyAvg > 0 && position <= base.reorderPoint && rawQty > 0;
  const multiple = casePack && casePack > 0 ? casePack : ORDER_ROUNDING_MULTIPLE;
  const suggestedQty = needsOrder ? roundUpToMultiple(Math.max(rawQty, moq ?? 0), multiple) : 0;
  const urgent = needsOrder && position < Math.ceil(base.dailyAvg * leadTimeDays);

  const daysOfCover = base.dailyAvg > 0 ? Math.max(0, currentStock) / base.dailyAvg : null;
  const orderInDays = base.dailyAvg > 0 ? Math.floor(Math.max(0, position) / base.dailyAvg - leadTimeDays) : null;

  return {
    ...base,
    incoming,
    rawQty,
    suggestedQty,
    needsOrder,
    urgent,
    daysOfCover,
    orderInDays,
    inStockDays: inStock.length,
  };
}
