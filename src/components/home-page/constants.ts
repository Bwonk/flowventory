import type {
  ChartMetric,
  ChartRange,
  ProductStatus,
  SortBy,
  StatusFilter,
  StockRange,
} from './types';

export const DEFAULT_SORT: SortBy = 'aciliyet';
export const ITEMS_PER_PAGE = 20;

export const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'tukendi', label: 'Tükendi' },
  { value: 'az-kalan', label: 'Az Kalan' },
  { value: 'saglikli', label: 'Sağlıklı' },
];

export const STOCK_RANGE_OPTIONS: ReadonlyArray<{ value: StockRange; label: string }> = [
  { value: 'all', label: 'Tüm Stoklar' },
  { value: '0', label: '0 (Tükendi)' },
  { value: '1-10', label: '1 – 10' },
  { value: '11-50', label: '11 – 50' },
  { value: '51-100', label: '51 – 100' },
  { value: '100+', label: '100+' },
];

export const SORT_OPTIONS: ReadonlyArray<{ value: SortBy; label: string }> = [
  { value: 'aciliyet', label: 'Aciliyet' },
  { value: 'stok-azalan', label: 'Stok (Azalan)' },
  { value: 'stok-artan', label: 'Stok (Artan)' },
  { value: 'isim-az', label: 'Ürün Adı (A-Z)' },
];

export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Tümü',
  tukendi: 'Tükendi',
  'az-kalan': 'Az Kalan',
  saglikli: 'Sağlıklı',
};

export const STOCK_RANGE_LABELS: Record<StockRange, string> = {
  all: 'Tüm Stoklar',
  '0': '0',
  '1-10': '1–10',
  '11-50': '11–50',
  '51-100': '51–100',
  '100+': '100+',
};

export const SORT_LABELS: Record<SortBy, string> = {
  aciliyet: 'Aciliyet',
  'stok-azalan': 'Stok (Azalan)',
  'stok-artan': 'Stok (Artan)',
  'isim-az': 'Ürün Adı (A-Z)',
};

export const STATUS_SEVERITY: Record<ProductStatus, number> = { critical: 0, warning: 1, healthy: 2 };

/** Cohere-token status treatment per durum. */
export const STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  critical: { label: 'Tükendi', className: 'border border-[#b30000] text-[#b30000] bg-transparent' },
  warning: { label: 'Az Kalan', className: 'border border-[#ff7759] text-[#ff7759] bg-transparent' },
  healthy: { label: 'Sağlıklı', className: 'border-transparent bg-[#edfce9] text-[#003c33]' },
};

export const RANGE_OPTIONS: ReadonlyArray<{ value: ChartRange; label: string }> = [
  { value: 'daily', label: 'Günlük' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];

export const METRIC_OPTIONS: ReadonlyArray<{ value: ChartMetric; label: string }> = [
  { value: 'revenue', label: 'Ciro' },
  { value: 'quantity', label: 'Satış Adedi' },
];

export const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const;

/** Modal rozetleri — ana tablo ile aynı yumuşak pill dili. */
export const MODAL_STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  critical: { label: 'Tükendi', className: 'bg-[#fef2f2] text-[#b30000]' },
  warning: { label: 'Az Kalan', className: 'bg-[#fffbeb] text-[#d97706]' },
  healthy: { label: 'Sağlıklı', className: 'bg-[#edfce9] text-[#003c33]' },
};
