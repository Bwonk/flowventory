import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';
import { AGING_BUCKET_ORDER } from '@/lib/reports/abc';
import type { ActionKey } from '@/lib/reports/actions';
import type { SellThroughBand } from '@/lib/reports/sell-through';

export const ABC_LABELS: Record<AbcClass, { title: string; description: string }> = {
  A: { title: 'A Sınıfı', description: 'Cironun ~%80\'i — sürekli izle, asla tükettirme' },
  B: { title: 'B Sınıfı', description: 'Cironun ~%15\'i — düzenli kontrol yeterli' },
  C: { title: 'C Sınıfı', description: 'Cironun ~%5\'i — stok bağlama, azaltmayı düşün' },
};

export const SELL_THROUGH_BAND_ORDER: SellThroughBand[] = ['yüksek', 'normal', 'düşük', 'satışsız'];

export const SELL_THROUGH_BAND_LABEL: Record<SellThroughBand, string> = {
  yüksek: 'Hızlı eriyen (%60+)',
  normal: 'Normal (%25-60)',
  düşük: 'Yavaş (%25 altı)',
  satışsız: 'Hiç satmayan',
};

export const SELL_THROUGH_BAND_DOT: Record<SellThroughBand, string> = {
  yüksek: 'bg-status-healthy',
  normal: 'bg-accent-blue',
  düşük: 'bg-status-warning',
  satışsız: 'bg-status-critical',
};

export const ABC_BADGE_CLASS: Record<AbcClass, string> = {
  A: 'bg-success text-success-foreground',
  B: 'bg-warning text-warning-foreground',
  C: 'bg-muted text-muted-foreground',
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
