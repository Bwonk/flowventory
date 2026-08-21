import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';
import { AGING_BUCKET_ORDER } from '@/lib/reports/abc';
import type { ActionKey } from '@/lib/reports/actions';
import type { SellThroughBand } from '@/lib/reports/sell-through';

export type AnalysisMetric = 'ciro' | 'kar';

export const ABC_LABELS: Record<AbcClass, { title: string; description: string }> = {
  A: { title: 'A Sınıfı', description: 'Cironun ~%80\'i — sürekli izle, asla tükettirme' },
  B: { title: 'B Sınıfı', description: 'Cironun ~%15\'i — düzenli kontrol yeterli' },
  C: { title: 'C Sınıfı', description: 'Cironun ~%5\'i — stok bağlama, azaltmayı düşün' },
};

export const ABC_LABELS_PROFIT: Record<AbcClass, { title: string; description: string }> = {
  A: { title: 'A Sınıfı', description: 'Kârın ~%80\'i — asıl para kazandıranlar' },
  B: { title: 'B Sınıfı', description: 'Kârın ~%15\'i — düzenli kontrol yeterli' },
  C: { title: 'C Sınıfı', description: 'Kârın ~%5\'i — marjı ya da stoğu gözden geçir' },
};

export const ANALYSIS_METRIC_OPTIONS: Array<{ value: AnalysisMetric; label: string }> = [
  { value: 'ciro', label: 'Ciro' },
  { value: 'kar', label: 'Kâr' },
];

export type WindowOption = '30' | '60';

export const WINDOW_OPTIONS: Array<{ value: WindowOption; label: string }> = [
  { value: '30', label: '30 gün' },
  { value: '60', label: '60 gün' },
];

export const SELL_THROUGH_BAND_ORDER: SellThroughBand[] = ['yüksek', 'normal', 'düşük', 'satışsız'];

export const SELL_THROUGH_BAND_LABEL: Record<SellThroughBand, string> = {
  yüksek: 'Hızlı eriyen (%60+)',
  normal: 'Normal (%25-60)',
  düşük: 'Yavaş (%25 altı)',
  satışsız: 'Hiç satmayan',
};

export const SELL_THROUGH_BAND_DOT: Record<SellThroughBand, string> = {
  yüksek: 'bg-status-healthy',
  normal: 'bg-muted-foreground',
  düşük: 'bg-status-warning',
  satışsız: 'bg-status-critical',
};

// --- Tablo filtreleri ---

export type AbcFilter = AbcClass | 'all';
export type AgingFilter = AgingBucketKey | 'all';
export type BandFilter = SellThroughBand | 'all';
export type ActionFilter = ActionKey | 'all';

export const ACTION_LABELS: Record<ActionKey, string> = {
  'siparis-ver': 'Sipariş ver',
  'eritme-adayi': 'Eritme adayı',
  'fazla-stok': 'Fazla stok',
};

export const AGING_FILTER_LABEL = (bucket: AgingBucketKey): string =>
  bucket === 'satışsız' ? 'Satışsız' : `${bucket} gün`;

export const AGING_FILTER_OPTIONS: Array<{ value: AgingFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  ...AGING_BUCKET_ORDER.map(bucket => ({ value: bucket as AgingFilter, label: AGING_FILTER_LABEL(bucket) })),
];

export const ABC_FILTER_OPTIONS: Array<{ value: AbcFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'A', label: 'A Sınıfı' },
  { value: 'B', label: 'B Sınıfı' },
  { value: 'C', label: 'C Sınıfı' },
];

export const BAND_FILTER_OPTIONS: Array<{ value: BandFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  ...SELL_THROUGH_BAND_ORDER.map(band => ({ value: band as BandFilter, label: SELL_THROUGH_BAND_LABEL[band] })),
];

export const ACTION_FILTER_OPTIONS: Array<{ value: ActionFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'siparis-ver', label: ACTION_LABELS['siparis-ver'] },
  { value: 'eritme-adayi', label: ACTION_LABELS['eritme-adayi'] },
  { value: 'fazla-stok', label: ACTION_LABELS['fazla-stok'] },
];

// --- Sıralama ---

export type AnalysisSortBy = 'ciro' | 'kar' | 'sermaye' | 'satis' | 'stok-omru';

export const DEFAULT_ANALYSIS_SORT: AnalysisSortBy = 'ciro';

export const ANALYSIS_SORT_LABELS: Record<AnalysisSortBy, string> = {
  ciro: 'Ciro',
  kar: 'Kâr',
  sermaye: 'Bağlı sermaye',
  satis: 'Satış adedi',
  'stok-omru': 'Stok ömrü',
};

export const ANALYSIS_SORT_OPTIONS: Array<{ value: AnalysisSortBy; label: string }> = (
  ['ciro', 'kar', 'sermaye', 'satis', 'stok-omru'] as AnalysisSortBy[]
).map(value => ({ value, label: ANALYSIS_SORT_LABELS[value] }));

// --- URL paramları ---
// Türkçe karakterli değerler ('satışsız', 'yüksek', '180+') URL'e ASCII slug ile
// taşınır; bilinmeyen slug sessizce yok sayılır (whitelist parse).

const AGING_SLUGS: Record<string, AgingBucketKey> = {
  '0-30': '0-30',
  '31-60': '31-60',
  '61-90': '61-90',
  '91-180': '91-180',
  '180plus': '180+',
  satissiz: 'satışsız',
};

const BAND_SLUGS: Record<string, SellThroughBand> = {
  yuksek: 'yüksek',
  normal: 'normal',
  dusuk: 'düşük',
  satissiz: 'satışsız',
};

const ACTION_SLUGS: Record<string, ActionKey> = {
  'siparis-ver': 'siparis-ver',
  'eritme-adayi': 'eritme-adayi',
  'fazla-stok': 'fazla-stok',
};

export function parseAbcParam(value: string | null): AbcClass | undefined {
  return value === 'A' || value === 'B' || value === 'C' ? value : undefined;
}

export function parseAgingParam(value: string | null): AgingBucketKey | undefined {
  return value ? AGING_SLUGS[value] : undefined;
}

export function parseBandParam(value: string | null): SellThroughBand | undefined {
  return value ? BAND_SLUGS[value] : undefined;
}

export function parseActionParam(value: string | null): ActionKey | undefined {
  return value ? ACTION_SLUGS[value] : undefined;
}
