/**
 * Sell-through, stok devir hızı ve tükeniş tahmini — saf hesap fonksiyonları.
 *
 * ABC "hangi ürün ciroyu taşıyor" sorusuna bakıyor; buradaki metrikler
 * "eldeki stok ne hızda eriyor" sorusuna bakıyor. İkisi farklı: yüksek cirolu
 * bir üründe stok da yüksekse sell-through düşüktür (sermaye bağlı kalır).
 *
 * ÖNEMLİ SINIR: `ProductSnapshot` tarihsel değil, her sync'te üzerine yazılıyor.
 * Yani elimizde dönem *ortalaması* değil, dönem *sonu* stoğu var. Klasik devir
 * hızı (satılan ÷ ortalama stok) yerine dönem sonu stoğuna göre yaklaşık
 * hesaplıyoruz — dönem içinde stok çok dalgalandıysa sapar. Bu yüzden UI'da
 * devir hızı "~" ile gösteriliyor.
 */

/** Yıla çevirirken kullanılan gün sayısı. */
const DAYS_IN_YEAR = 365;

export type SellThroughBand = 'yüksek' | 'normal' | 'düşük' | 'satışsız';

export const SELL_THROUGH_HIGH = 0.6;
export const SELL_THROUGH_LOW = 0.25;

/**
 * Dönemde satılan adedin, "elde olabilecek toplam"a oranı:
 * satılan ÷ (satılan + kalan stok).
 *
 * Bu formül dönem başı stoğunu bilmediğimiz için standart yaklaşımdır;
 * 1'e yaklaşması "gelen mal satıldı", 0'a yaklaşması "mal elde kaldı" demek.
 *
 * @returns 0..1 arası oran; ne satış ne stok varsa null (ürün hakkında bilgi yok).
 */
export function sellThroughRate(soldQty: number, currentStock: number): number | null {
  const sold = Math.max(0, soldQty);
  const stock = Math.max(0, currentStock);
  const total = sold + stock;
  if (total <= 0) return null;
  return sold / total;
}

/** Oranı yorumlanabilir bir banda indirger. Stoklu ama hiç satmayan ürün "satışsız". */
export function sellThroughBand(soldQty: number, currentStock: number): SellThroughBand | null {
  const rate = sellThroughRate(soldQty, currentStock);
  if (rate === null) return null;
  if (soldQty <= 0) return 'satışsız';
  if (rate >= SELL_THROUGH_HIGH) return 'yüksek';
  if (rate >= SELL_THROUGH_LOW) return 'normal';
  return 'düşük';
}

/**
 * Yıllıklandırılmış stok devir hızı: (dönem satışı → yıllık) ÷ mevcut stok.
 * "Bu hızla gidersek stok yılda kaç kez döner" sorusunun yaklaşık cevabı.
 *
 * @returns devir katsayısı; stok yoksa (ölçülemez) null.
 */
export function annualTurnoverRate(
  soldQty: number,
  windowDays: number,
  currentStock: number,
): number | null {
  if (windowDays <= 0 || currentStock <= 0) return null;
  const annualSales = (Math.max(0, soldQty) / windowDays) * DAYS_IN_YEAR;
  return annualSales / currentStock;
}

/**
 * Mevcut stok, dönem satış hızıyla kaç gün sonra biter.
 *
 * @returns gün sayısı; stok zaten yoksa 0; satış yoksa (tahmin edilemez) null.
 */
export function daysUntilStockout(
  currentStock: number,
  soldQty: number,
  windowDays: number,
): number | null {
  if (currentStock <= 0) return 0;
  if (windowDays <= 0 || soldQty <= 0) return null;
  const dailyAvg = soldQty / windowDays;
  return Math.round(currentStock / dailyAvg);
}

/**
 * Tükeniş tahmininin anlamlı sayıldığı üst sınır (2 yıl).
 * Ayda 1 satan, 500 stoklu bir üründe formül "2100 yılında biter" der;
 * böyle bir tarih bilgi değil gürültüdür — o ürünün sorunu ölü stok olması.
 */
export const STOCKOUT_FORECAST_HORIZON_DAYS = 730;

export function isWithinForecastHorizon(days: number | null): days is number {
  return days !== null && days <= STOCKOUT_FORECAST_HORIZON_DAYS;
}

/**
 * Tedarik süresi dolmadan tükenecek mi?
 * Sipariş bugün verilse mal gelmeden stok biterse satış kaybı olur.
 */
export function isStockoutBeforeLeadTime(
  days: number | null,
  leadTimeDays: number,
): boolean {
  if (days === null) return false;
  return days <= leadTimeDays;
}

export interface SellThroughTotals {
  soldUnits: number;
  stockUnits: number;
}

/**
 * Mağaza geneli sell-through — ürün oranlarının ortalaması değil, toplam
 * adetlerin oranı. (Ortalama alınsaydı 1 adetlik ürün 1000 adetlik ürünle
 * aynı ağırlığa sahip olurdu.)
 */
export function overallSellThrough(totals: SellThroughTotals): number | null {
  return sellThroughRate(totals.soldUnits, totals.stockUnits);
}
