import type {
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
  { value: 'kritik', label: 'Kritik' },
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
  { value: 'stok-omru', label: 'Stok Ömrü (Azalan)' },
  { value: 'stok-azalan', label: 'Stok (Azalan)' },
  { value: 'stok-artan', label: 'Stok (Artan)' },
  { value: 'isim-az', label: 'Ürün Adı (A-Z)' },
];

export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Tümü',
  tukendi: 'Tükendi',
  kritik: 'Kritik',
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
  'stok-omru': 'Stok Ömrü (Azalan)',
  'stok-azalan': 'Stok (Azalan)',
  'stok-artan': 'Stok (Artan)',
  'isim-az': 'Ürün Adı (A-Z)',
};

export const STATUS_SEVERITY: Record<ProductStatus, number> = { out: 0, critical: 1, warning: 2, healthy: 3 };

/** Durum başına etiket + rozet stili. */
export const STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  out: { label: 'Tükendi', className: 'border border-destructive text-destructive bg-transparent' },
  critical: { label: 'Kritik', className: 'border border-destructive text-destructive bg-transparent' },
  warning: { label: 'Az Kalan', className: 'border border-status-warning text-status-warning bg-transparent' },
  healthy: { label: 'Sağlıklı', className: 'border-transparent bg-success text-success-foreground' },
};

export const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const;
