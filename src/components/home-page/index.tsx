"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Search,
  Package,
  X,
  ChevronDown,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ListProductsApiResponse } from '@/app/api/ikas/list-products/route';
import { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStockThreshold } from '@/lib/stock-threshold';

type Product = NonNullable<ListProductsApiResponse['products']>[0];
type Variant = Product['variants'][number];
type ProductStatus = 'critical' | 'warning' | 'healthy';

interface ProductRow {
  productId: string;
  productName: string;
  category?: string;
  thumbnail?: string;
  status: ProductStatus;
  totalStock: number;
  variantCount: number;
}

interface HomePageProps {
  token: string | null;
  storeName?: string;
  products: Product[];
  analytics: AnalyticsApiResponse | null;
  loading: boolean;
}

type StatusFilter = 'all' | 'tukendi' | 'az-kalan' | 'saglikli';
type StockRange = 'all' | '0' | '1-10' | '11-50' | '51-100' | '100+';
type SortBy = 'aciliyet' | 'stok-azalan' | 'stok-artan' | 'isim-az';

const DEFAULT_SORT: SortBy = 'aciliyet';
const ITEMS_PER_PAGE = 20;

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'tukendi', label: 'Tükendi' },
  { value: 'az-kalan', label: 'Az Kalan' },
  { value: 'saglikli', label: 'Sağlıklı' },
];

const STOCK_RANGE_OPTIONS: ReadonlyArray<{ value: StockRange; label: string }> = [
  { value: 'all', label: 'Tüm Stoklar' },
  { value: '0', label: '0 (Tükendi)' },
  { value: '1-10', label: '1 – 10' },
  { value: '11-50', label: '11 – 50' },
  { value: '51-100', label: '51 – 100' },
  { value: '100+', label: '100+' },
];

const SORT_OPTIONS: ReadonlyArray<{ value: SortBy; label: string }> = [
  { value: 'aciliyet', label: 'Aciliyet' },
  { value: 'stok-azalan', label: 'Stok (Azalan)' },
  { value: 'stok-artan', label: 'Stok (Artan)' },
  { value: 'isim-az', label: 'Ürün Adı (A-Z)' },
];

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Tümü',
  tukendi: 'Tükendi',
  'az-kalan': 'Az Kalan',
  saglikli: 'Sağlıklı',
};

const STOCK_RANGE_LABELS: Record<StockRange, string> = {
  all: 'Tüm Stoklar',
  '0': '0',
  '1-10': '1–10',
  '11-50': '11–50',
  '51-100': '51–100',
  '100+': '100+',
};

const SORT_LABELS: Record<SortBy, string> = {
  aciliyet: 'Aciliyet',
  'stok-azalan': 'Stok (Azalan)',
  'stok-artan': 'Stok (Artan)',
  'isim-az': 'Ürün Adı (A-Z)',
};

function getProductStatus(product: Product, lowThreshold = 10): 'critical' | 'warning' | 'healthy' {
  let hasWarning = false;
  for (const variant of product.variants) {
    const stock = variant.stocks?.[0]?.stockCount ?? 0;
    if (stock === 0) return 'critical';
    if (stock <= lowThreshold) hasWarning = true;
  }
  return hasWarning ? 'warning' : 'healthy';
}

/** Ürünün ilk kategori adını döndürür; kategori yoksa undefined. */
function getProductCategory(product: Product): string | undefined {
  return product.categories?.find(c => !!c.name)?.name ?? undefined;
}

/** Ürünün gösterilecek ana görseli: ilk görseli olan varyant. */
function getProductThumbnail(product: Product): string | undefined {
  return product.variants.find(v => v.imageUrl)?.imageUrl ?? undefined;
}

/** Bir varyantın okunabilir adı (variantValues → SKU → fallback). */
function getVariantName(variant: Variant): string {
  if (variant.variantValues && variant.variantValues.length > 0) {
    return variant.variantValues.map(v => v.variantValueName).join(' / ');
  }
  return variant.sku || 'Varsayılan';
}

function getVariantStock(variant: Variant): number {
  return variant.stocks?.[0]?.stockCount ?? 0;
}

/** Ürünün toplam stok adedi (tüm varyantların toplamı). */
function getTotalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + getVariantStock(v), 0);
}

/** Tek bir stok değerinden durum türetir. */
function stockToStatus(stock: number, lowThreshold = 10): ProductStatus {
  if (stock === 0) return 'critical';
  if (stock <= lowThreshold) return 'warning';
  return 'healthy';
}

/** Ürünü tek satıra indirger: en kötü varyant durumu + toplam stok. */
function flattenToProducts(products: Product[], lowThreshold = 10): ProductRow[] {
  return products.map(product => ({
    productId: product.id,
    productName: product.name,
    category: getProductCategory(product),
    thumbnail: getProductThumbnail(product),
    status: getProductStatus(product, lowThreshold),
    totalStock: getTotalStock(product),
    variantCount: product.variants.length,
  }));
}

function matchesStockRange(stock: number, range: StockRange): boolean {
  switch (range) {
    case '0':
      return stock === 0;
    case '1-10':
      return stock >= 1 && stock <= 10;
    case '11-50':
      return stock >= 11 && stock <= 50;
    case '51-100':
      return stock >= 51 && stock <= 100;
    case '100+':
      return stock > 100;
    default:
      return true;
  }
}

const STATUS_SEVERITY: Record<ProductStatus, number> = { critical: 0, warning: 1, healthy: 2 };

function sortRows(rows: ProductRow[], sortBy: SortBy): ProductRow[] {
  const copy = [...rows];
  switch (sortBy) {
    case 'stok-azalan':
      return copy.sort((a, b) => b.totalStock - a.totalStock);
    case 'stok-artan':
      return copy.sort((a, b) => a.totalStock - b.totalStock);
    case 'isim-az':
      return copy.sort((a, b) => a.productName.localeCompare(b.productName, 'tr'));
    case 'aciliyet':
    default:
      // En acil (kritik) önce; eşitse en düşük toplam stok üstte.
      return copy.sort(
        (a, b) => STATUS_SEVERITY[a.status] - STATUS_SEVERITY[b.status] || a.totalStock - b.totalStock,
      );
  }
}

function filterRows(
  rows: ProductRow[],
  statusFilter: StatusFilter,
  query: string,
  stockRange: StockRange,
  sortBy: SortBy,
): ProductRow[] {
  const q = query.toLowerCase().trim();
  let filtered = rows;

  // Birincil filtre: en kötü varyant durumuna göre.
  if (statusFilter === 'tukendi') filtered = filtered.filter(r => r.status === 'critical');
  else if (statusFilter === 'az-kalan') filtered = filtered.filter(r => r.status === 'warning');
  else if (statusFilter === 'saglikli') filtered = filtered.filter(r => r.status === 'healthy');

  // İkincil filtre: toplam stok aralığı.
  if (stockRange !== 'all') {
    filtered = filtered.filter(r => matchesStockRange(r.totalStock, stockRange));
  }

  // Arama filtresi (ürün adı).
  if (q) {
    filtered = filtered.filter(r => r.productName.toLowerCase().includes(q));
  }

  // Sıralama.
  return sortRows(filtered, sortBy);
}

function downloadCSV(rows: ProductRow[]) {
  const headers = ['Ürün Adı', 'Kategori', 'Durum', 'Toplam Stok', 'Varyant Sayısı'];
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const cells = [
      `"${row.productName.replace(/"/g, '""')}"`,
      `"${(row.category ?? '').replace(/"/g, '""')}"`,
      STATUS_META[row.status].label,
      row.totalStock,
      row.variantCount,
    ];
    csvRows.push(cells.join(','));
  }
  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stok-raporu-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Cohere-token status treatment per durum. */
const STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  critical: { label: 'Tükendi', className: 'border border-[#b30000] text-[#b30000] bg-transparent' },
  warning: { label: 'Az Kalan', className: 'border border-[#ff7759] text-[#ff7759] bg-transparent' },
  healthy: { label: 'Sağlıklı', className: 'border-transparent bg-[#edfce9] text-[#003c33]' },
};

const StatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
  const { label, className } = STATUS_META[status];
  return (
    <Badge className={`rounded-full px-3 py-1 text-[12px] font-medium shadow-none ${className}`}>
      {label}
    </Badge>
  );
};

function formatPrice(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

/** 'YYYY-MM-DD' → 'DD.MM'. */
function formatDayMonth(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MonoLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={`font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a] ${className ?? ''}`}>
    {children}
  </p>
);

/** Ürün görseli; kaynak yoksa veya yüklenemezse nötr placeholder'a düşer. */
const ProductThumb: React.FC<{ src?: string; alt: string; sizeClass?: string }> = ({
  src,
  alt,
  sizeClass = 'h-10 w-10',
}) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={`flex ${sizeClass} items-center justify-center rounded-lg bg-[#eeece7]`}>
        <Package className="h-4 w-4 text-[#93939f]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`${sizeClass} rounded-lg object-cover`}
    />
  );
};

interface DropdownProps {
  label: React.ReactNode;
  active?: boolean;
  align?: 'start' | 'end';
  panelClassName?: string;
  children: (close: () => void) => React.ReactNode;
}

/** Popover/Select yerine kullanılan hafif özel dropdown (useState + absolute konum). */
const Dropdown: React.FC<DropdownProps> = ({ label, active, align = 'start', panelClassName, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6] ${
          active
            ? 'bg-[#eeece7] font-medium text-[#17171c]'
            : 'text-[#75758a] hover:bg-[#f2f2f2] hover:text-[#17171c]'
        }`}
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute z-50 mt-2 min-w-[200px] rounded-[12px] border border-[#e5e7eb] bg-[#ffffff] p-1.5 shadow-[0_10px_30px_rgba(23,23,28,0.10)] ${
            align === 'end' ? 'right-0' : 'left-0'
          } ${panelClassName ?? ''}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

const OptionButton: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({
  label,
  selected,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left text-[14px] text-[#17171c] transition-colors hover:bg-[#f2f2f2]"
  >
    <span className="truncate">{label}</span>
    {selected && <Check className="h-4 w-4 shrink-0 text-[#1863dc]" />}
  </button>
);

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <button
    type="button"
    onClick={onRemove}
    className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f4f6] px-3 py-1 text-[14px] text-[#374151] transition-colors hover:bg-[#e5e7eb] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6]"
  >
    {label}
    <X className="h-3.5 w-3.5 text-[#374151]" />
  </button>
);

/** Stok eşiği için etiketli sayı girişi (min ≤ max normalize üst katmanda yapılır). */
const ThresholdInput: React.FC<{
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}> = ({ label, value, max, onChange }) => (
  <label className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#e5e7eb] bg-[#ffffff] py-1 pl-2.5 pr-1 text-[13px] text-[#616161] transition-colors focus-within:border-[#4c6ee6] focus-within:ring-2 focus-within:ring-[#4c6ee6]/15">
    <span className="whitespace-nowrap">{label}</span>
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value}
      onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className="h-6 w-12 rounded-[6px] bg-[#f8f9fa] text-center text-[13px] font-medium tabular-nums text-[#212121] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  </label>
);

type ChartRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
type ChartMetric = 'revenue' | 'quantity';

const RANGE_OPTIONS: ReadonlyArray<{ value: ChartRange; label: string }> = [
  { value: 'daily', label: 'Günlük' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];

const METRIC_OPTIONS: ReadonlyArray<{ value: ChartMetric; label: string }> = [
  { value: 'revenue', label: 'Ciro' },
  { value: 'quantity', label: 'Satış Adedi' },
];

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const;

/** Modal rozetleri — ana tablo ile aynı yumuşak pill dili. */
const MODAL_STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  critical: { label: 'Tükendi', className: 'bg-[#fef2f2] text-[#b30000]' },
  warning: { label: 'Az Kalan', className: 'bg-[#fffbeb] text-[#d97706]' },
  healthy: { label: 'Sağlıklı', className: 'bg-[#edfce9] text-[#003c33]' },
};

const ModalStatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
  const meta = MODAL_STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
};

/** Progress bar dolgu rengi (duruma göre). */
function statusFillColor(status: ProductStatus): string {
  if (status === 'critical') return '#b30000';
  if (status === 'warning') return '#d97706';
  return '#003c33';
}

interface DaySeriesPoint {
  date: string;
  revenue: number;
  units: number;
}

/** Günlük seriyi seçili zaman aralığına göre gruplar (kronolojik sırayla). */
function groupSeries(
  series: DaySeriesPoint[],
  range: ChartRange,
): Array<{ label: string; revenue: number; units: number }> {
  if (range === 'daily') {
    return series.map(s => ({ label: formatDayMonth(s.date), revenue: s.revenue, units: s.units }));
  }
  const map = new Map<string, { label: string; revenue: number; units: number; order: number }>();
  for (const s of series) {
    const d = new Date(s.date);
    if (Number.isNaN(d.getTime())) continue;
    let key: string;
    let label: string;
    let order: number;
    if (range === 'weekly') {
      const weekday = (d.getDay() + 6) % 7; // Pazartesi = 0
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
    const existing = map.get(key) ?? { label, revenue: 0, units: 0, order };
    existing.revenue += s.revenue;
    existing.units += s.units;
    map.set(key, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map(({ label, revenue, units }) => ({ label, revenue, units }));
}

/** Aydınlık temalı özel tooltip. */
const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: ChartMetric;
}> = ({ active, payload, label, metric }) => {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#ffffff] px-3 py-2 shadow-sm">
      <p className="text-[12px] text-[#75758a]">{label}</p>
      <p className="text-[14px] font-medium text-[#17171c]">
        {metric === 'revenue' ? formatPrice(value) : `${value} adet`}
      </p>
    </div>
  );
};

/** Görsele (ilk varyant görseli) sahip aydınlık modal başlık görseli. */
const ModalProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#f8f9fa]">
        <Package className="h-7 w-7 text-[#93939f]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className="h-24 w-24 shrink-0 rounded-xl border border-[#e5e7eb] object-cover"
    />
  );
};

/** Kompakt varyant kartı: ad + durum noktası, büyük stok, ince bar, fiyat. */
const VariantCard: React.FC<{
  label: string;
  stock: number;
  priceLabel: string;
  status: ProductStatus;
  selected: boolean;
  fillPercent: number;
  onClick: () => void;
}> = ({ label, stock, priceLabel, status, selected, fillPercent, onClick }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let stateClass: string;
  if (selected) stateClass = 'border-[#17171c] bg-[#f8f9fa]';
  else if (status === 'critical') stateClass = 'border-[#fca5a5] bg-[#fef2f2] hover:opacity-90';
  else if (status === 'warning') stateClass = 'border-[#fcd34d] bg-[#fffbeb] hover:opacity-90';
  else stateClass = 'border-[#e5e7eb] bg-[#ffffff] hover:bg-[#f8f9fa]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col rounded-xl border-2 p-4 text-left transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6] ${stateClass}`}
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-[14px] font-medium text-[#17171c]">{label}</span>
        <span
          className="ml-auto h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: statusFillColor(status) }}
        />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[20px] font-semibold leading-none text-[#17171c]">{stock}</span>
        <span className="text-[13px] text-[#75758a]">adet</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${mounted ? fillPercent : 0}%`, backgroundColor: statusFillColor(status) }}
        />
      </div>
      <span className="mt-2 text-[13px] text-[#75758a]">{priceLabel}</span>
    </button>
  );
};

/** Sol kolon hero kartı: ürün-seviyesi toplam stok + 30 günlük ciro. */
const TumuCard: React.FC<{
  totalStock: number;
  productRevenue: number;
  variantCount: number;
  status: ProductStatus;
  selected: boolean;
  onClick: () => void;
}> = ({ totalStock, productRevenue, variantCount, status, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`flex w-full flex-col rounded-xl p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6] ${
      selected ? 'border-2 border-[#17171c] bg-[#ffffff]' : 'border border-[#e5e7eb] bg-[#ffffff] hover:bg-[#f8f9fa]'
    }`}
  >
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">Toplam Stok</span>
        <span className="text-[24px] font-semibold leading-tight tracking-tight text-[#17171c]">{totalStock}</span>
        <span className="text-[13px] text-[#75758a]">adet</span>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">30 Günlük Ciro</span>
        <span className="text-[20px] font-semibold leading-tight tracking-tight text-[#17171c]">
          {formatPrice(productRevenue)}
        </span>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e5e7eb] pt-3">
      <ModalStatusBadge status={status} />
      <span className="text-[13px] text-[#75758a]">{variantCount} varyant</span>
    </div>
  </button>
);

type TopProduct = AnalyticsApiResponse['topProducts'][number];

/** Bu ürüne ait varyantların 30 günlük toplam cirosu. */
function getProductRevenue(product: Product, topProducts: TopProduct[]): number {
  return topProducts
    .filter(p => product.variants.some(v => v.id === p.variantId))
    .reduce((sum, p) => sum + p.revenue, 0);
}

/** Bu ürüne ait varyantların 30 günlük toplam satış adedi. */
function getProductQuantity(product: Product, topProducts: TopProduct[]): number {
  return topProducts
    .filter(p => product.variants.some(v => v.id === p.variantId))
    .reduce((sum, p) => sum + p.quantity, 0);
}

function getVariantRevenue(variantId: string, topProducts: TopProduct[]): number {
  return topProducts.find(p => p.variantId === variantId)?.revenue ?? 0;
}

function getVariantQuantity(variantId: string, topProducts: TopProduct[]): number {
  return topProducts.find(p => p.variantId === variantId)?.quantity ?? 0;
}

/** Ürün detay modalı içeriği: başlık, varyant kartları, aydınlık satış grafiği. */
const ProductDetailContent: React.FC<{
  product: Product;
  analytics: AnalyticsApiResponse | null;
  lowThreshold?: number;
}> = ({ product, analytics, lowThreshold = 10 }) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('all');
  const [range, setRange] = useState<ChartRange>('daily');
  const [metric, setMetric] = useState<ChartMetric>('revenue');

  const variants = product.variants;
  const totalStock = getTotalStock(product);
  const overallStatus = getProductStatus(product, lowThreshold);
  const category = getProductCategory(product);
  const productImage = getProductThumbnail(product);

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const dailyRevenue = analytics?.dailyRevenue ?? [];
  const topProducts = useMemo(() => analytics?.topProducts ?? [], [analytics]);
  const sumDaily = useMemo(() => dailyRevenue.reduce((s, d) => s + d.revenue, 0), [dailyRevenue]);

  // Ürün-seviyesi agregatlar (mağaza toplamı DEĞİL).
  const productRevenue = useMemo(() => getProductRevenue(product, topProducts), [product, topProducts]);
  const productQuantity = useMemo(() => getProductQuantity(product, topProducts), [product, topProducts]);

  const selectedVariant =
    selectedVariantId === 'all' ? null : variants.find(v => v.id === selectedVariantId) ?? null;

  // Grafik kapsamına (Tümü / seçili varyant) göre hedef ciro, adet ve pay.
  const targetRevenue = selectedVariant ? getVariantRevenue(selectedVariant.id, topProducts) : productRevenue;
  const soldCount = selectedVariant ? getVariantQuantity(selectedVariant.id, topProducts) : productQuantity;
  const share = totalRevenue > 0 ? targetRevenue / totalRevenue : 0;

  // Günlük seri: ciro = pay × günlük mağaza cirosu; adet = hedef adet günlük ciroya orantılı dağıtılır.
  const dailySeries = useMemo<DaySeriesPoint[]>(
    () =>
      dailyRevenue.map(d => ({
        date: d.date,
        revenue: Math.round(d.revenue * share * 100) / 100,
        units: sumDaily > 0 ? soldCount * (d.revenue / sumDaily) : 0,
      })),
    [dailyRevenue, share, soldCount, sumDaily],
  );

  const grouped = useMemo(() => groupSeries(dailySeries, range), [dailySeries, range]);
  const chartData = useMemo(
    () =>
      grouped.map(g => ({ label: g.label, value: metric === 'revenue' ? Math.round(g.revenue) : Math.round(g.units) })),
    [grouped, metric],
  );
  const periodRevenue = useMemo(() => dailySeries.reduce((s, d) => s + d.revenue, 0), [dailySeries]);
  const hasData = targetRevenue > 0 && dailyRevenue.length > 0 && periodRevenue > 0;

  const maxStock = useMemo(() => variants.reduce((m, v) => Math.max(m, getVariantStock(v)), 0), [variants]);

  // Kartları önem sırasına diz: tükenen → az kalan → sağlıklı.
  const variantsSorted = useMemo(
    () =>
      [...variants].sort((a, b) => {
        const sa = STATUS_SEVERITY[stockToStatus(getVariantStock(a), lowThreshold)];
        const sb = STATUS_SEVERITY[stockToStatus(getVariantStock(b), lowThreshold)];
        return sa - sb || getVariantStock(a) - getVariantStock(b);
      }),
    [variants, lowThreshold],
  );

  return (
    <div className="flex max-h-[85vh] flex-col max-sm:max-h-full">
      {/* Başlık — tam genişlik, yatay */}
      <div className="flex items-start gap-4 border-b border-[#e5e7eb] p-6 pb-4 pr-12">
        <ModalProductImage src={productImage} alt={product.name} />
        <div className="flex min-w-0 flex-col gap-2">
          <DialogTitle className="text-[24px] font-semibold leading-[1.2] tracking-tight text-[#17171c]">
            {product.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {product.name} ürününün varyant ve satış detayları
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <span className="inline-flex rounded-full bg-[#f1f5ff] px-2.5 py-0.5 text-[12px] font-medium text-[#1863dc]">
                {category}
              </span>
            )}
            <ModalStatusBadge status={overallStatus} />
          </div>
          <span className="text-[14px] text-[#75758a]">
            {variants.length} varyant • Toplam {totalStock} adet stok
          </span>
        </div>
      </div>

      {/* Gövde — iki kolon: sol sabit 380px, sağ esner (grafik) */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 md:flex-row md:gap-0">
        {/* Sol panel */}
        <div className="flex flex-col gap-4 md:w-[380px] md:flex-shrink-0 md:pr-5">
          <TumuCard
            totalStock={totalStock}
            productRevenue={productRevenue}
            variantCount={variants.length}
            status={overallStatus}
            selected={selectedVariantId === 'all'}
            onClick={() => setSelectedVariantId('all')}
          />
          {variantsSorted.length > 0 && (
            <div>
              <MonoLabel className="mb-2">Varyantlar</MonoLabel>
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                {variantsSorted.map(v => {
                  const stock = getVariantStock(v);
                  const price = v.prices?.[0]?.sellPrice ?? 0;
                  return (
                    <VariantCard
                      key={v.id}
                      label={getVariantName(v)}
                      stock={stock}
                      priceLabel={price > 0 ? formatPrice(price) : '—'}
                      status={stockToStatus(stock, lowThreshold)}
                      selected={selectedVariantId === v.id}
                      fillPercent={maxStock > 0 ? Math.min((stock / maxStock) * 100, 100) : 0}
                      onClick={() => setSelectedVariantId(v.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sağ panel — grafik (mobilde Tümü/varyantlardan önce) */}
        <div className="order-first flex min-w-0 flex-1 md:order-none">
          <div className="flex w-full flex-1 flex-col rounded-xl border border-[#e5e7eb] bg-[#f8f9fa] p-5">
            {/* Üst satır: başlık + dönem sekmeleri */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col">
                <p className="text-[14px] font-medium text-[#17171c]">Satış Grafiği</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
                  {selectedVariant ? getVariantName(selectedVariant) : 'Tüm Varyantlar'} · Son 30 Gün
                </p>
              </div>
              <div className="inline-flex flex-wrap rounded-full border border-[#e5e7eb] bg-[#ffffff] p-0.5">
                {RANGE_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setRange(o.value)}
                    className={`rounded-full px-3 py-1 text-[12px] transition-colors duration-100 ${
                      range === o.value ? 'bg-[#17171c] text-[#ffffff]' : 'text-[#75758a] hover:text-[#17171c]'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metrik anahtarı */}
            <div className="mt-3 inline-flex items-center gap-2">
              {METRIC_OPTIONS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMetric(m.value)}
                  className={`rounded-full px-3 py-1 text-[12px] transition-colors duration-100 ${
                    metric === m.value
                      ? 'bg-[#17171c] text-[#ffffff]'
                      : 'border border-[#e5e7eb] text-[#75758a] hover:text-[#17171c]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {hasData ? (
              <>
                <div className="mt-4 min-h-[200px] w-full flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id="lightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#17171c" stopOpacity={0.06} />
                          <stop offset="100%" stopColor="#17171c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#75758a', fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={16}
                      />
                      <Tooltip
                        content={<ChartTooltip metric={metric} />}
                        cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#17171c"
                        strokeWidth={1.5}
                        fill="url(#lightGradient)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#17171c', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 border-t border-[#e5e7eb] pt-3 text-[12px] text-[#75758a]">
                  Seçili dönemde toplam{' '}
                  <span className="font-medium text-[#17171c]">{formatPrice(periodRevenue)}</span> ciro ·{' '}
                  <span className="font-medium text-[#17171c]">{soldCount}</span> adet satış
                </p>
              </>
            ) : (
              <div className="mt-4 flex min-h-[200px] flex-1 items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] text-center">
                <p className="text-[14px] text-[#75758a]">Bu ürün için henüz satış verisi yok</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const HomePage: React.FC<HomePageProps> = ({ token, products = [], analytics, loading }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [stockRange, setStockRange] = useState<StockRange>('all');
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { threshold, setThreshold } = useStockThreshold();

  const productRows = useMemo(
    () => flattenToProducts(products, threshold.max),
    [products, threshold.max],
  );

  const filteredRows = useMemo(
    () => filterRows(productRows, statusFilter, query, stockRange, sortBy),
    [productRows, statusFilter, query, stockRange, sortBy],
  );

  // Herhangi bir filtre veya eşik değişince ilk sayfaya dön.
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, query, stockRange, sortBy, threshold.max]);

  // Pagination (client-side).
  const totalResults = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pagedRows = filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (stockRange !== 'all' ? 1 : 0) +
    (sortBy !== DEFAULT_SORT ? 1 : 0) +
    (query.trim() !== '' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setStatusFilter('all');
    setQuery('');
    setStockRange('all');
    setSortBy(DEFAULT_SORT);
    setCurrentPage(1);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#ffffff] font-sans">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <MonoLabel>Flowventory</MonoLabel>
            <h1 className="text-4xl font-normal leading-none tracking-[-0.03em] text-[#17171c] sm:text-5xl">
              Kimlik Doğrulama Gerekli
            </h1>
            <p className="text-[16px] leading-[1.5] text-[#616161]">
              Uygulama eylemlerini kullanmak için lütfen ikas üzerinden kimlik doğrulaması yapın.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ffffff] font-sans">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 h-4 w-32 animate-pulse rounded-full bg-[#eeece7]" />
          <div className="mb-10 h-12 w-64 animate-pulse rounded-[8px] bg-[#eeece7]" />
          <div className="mb-6 h-40 w-full animate-pulse rounded-[22px] bg-[#eeece7]" />
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[16px] bg-[#eeece7]" />
            ))}
          </div>
          <div className="h-64 w-full animate-pulse rounded-[16px] bg-[#eeece7]" />
        </div>
      </div>
    );
  }

  const topProducts = analytics?.topProducts ?? [];

  return (
    <div className="min-h-screen bg-[#ffffff] font-sans text-[#212121]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Başlık */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#75758a]">
              STOK YÖNETİMİ
            </p>
            <h1 className="text-3xl font-normal tracking-[-0.03em] text-[#17171c]">Stok Takibi</h1>
          </div>
          <Button
            onClick={() => downloadCSV(pagedRows)}
            className="h-auto gap-2 rounded-full bg-[#17171c] px-6 py-3 text-[14px] font-medium text-[#ffffff] shadow-none transition-colors hover:bg-[#000000]"
          >
            <Download className="h-4 w-4" />
            CSV İndir
          </Button>
        </header>

        {/* Birleşik filtre konteyneri — tek kart, iki satır (arama+filtreler / çipler) */}
        <div className="mb-8 rounded-[12px] border border-[#e5e7eb] bg-[#ffffff]">
          {/* Satır 1: arama solda, filtre dropdown'ları sağda */}
          <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93939f]" />
              <Input
                placeholder="Ürün veya varyant ara..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-10 w-full border-0 bg-transparent pl-10 text-[14px] text-[#212121] shadow-none placeholder:text-[#93939f] focus-visible:border-0 focus-visible:ring-0"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap sm:border-l sm:border-[#e5e7eb] sm:pl-2">
              {/* Durum */}
              <Dropdown label={<>Durum: {STATUS_LABELS[statusFilter]}</>} active={statusFilter !== 'all'}>
                {close =>
                  STATUS_OPTIONS.map(o => (
                    <OptionButton
                      key={o.value}
                      label={o.label}
                      selected={statusFilter === o.value}
                      onClick={() => {
                        setStatusFilter(o.value);
                        close();
                      }}
                    />
                  ))
                }
              </Dropdown>

              {/* Stok Aralığı */}
              <Dropdown
                label={<>{stockRange === 'all' ? 'Stok Aralığı' : `Stok: ${STOCK_RANGE_LABELS[stockRange]}`}</>}
                active={stockRange !== 'all'}
              >
                {close =>
                  STOCK_RANGE_OPTIONS.map(o => (
                    <OptionButton
                      key={o.value}
                      label={o.label}
                      selected={stockRange === o.value}
                      onClick={() => {
                        setStockRange(o.value);
                        close();
                      }}
                    />
                  ))
                }
              </Dropdown>

              {/* Sıralama */}
              <Dropdown label={<>Sıralama: {SORT_LABELS[sortBy]}</>} active={sortBy !== DEFAULT_SORT} align="end">
                {close =>
                  SORT_OPTIONS.map(o => (
                    <OptionButton
                      key={o.value}
                      label={o.label}
                      selected={sortBy === o.value}
                      onClick={() => {
                        setSortBy(o.value);
                        close();
                      }}
                    />
                  ))
                }
              </Dropdown>
            </div>
          </div>

          {/* Satır 2: stok eşiği ayarı — mağaza geneli, dashboard ile paylaşılır */}
          <div className="flex flex-col gap-2.5 border-t border-[#e5e7eb] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#75758a]">
                Stok Eşiği
              </span>
              <div className="flex items-center gap-2">
                <ThresholdInput
                  label="Kritik ≤"
                  value={threshold.min}
                  max={threshold.max}
                  onChange={min => setThreshold({ min })}
                />
                <ThresholdInput
                  label="Az kalan ≤"
                  value={threshold.max}
                  onChange={max => setThreshold({ max })}
                />
              </div>
            </div>
            <p className="text-[12px] leading-[1.4] text-[#93939f]">
              {threshold.max} adet ve altındaki ürünler dashboard’da{' '}
              <span className="text-[#616161]">Az Kalan Ürünler</span> olarak listelenir.
            </p>
          </div>

          {/* Satır 3: aktif filtre çipleri — yalnızca en az bir filtre etkinse görünür */}
          {hasActiveFilters && (
            <>
              <div className="h-px w-full bg-[#e5e7eb]" />
              <div className="flex flex-wrap items-center gap-2 p-3">
                {query.trim() !== '' && (
                  <FilterChip label={`Arama: “${query.trim()}”`} onRemove={() => setQuery('')} />
                )}
                {statusFilter !== 'all' && (
                  <FilterChip
                    label={`Durum: ${STATUS_LABELS[statusFilter]}`}
                    onRemove={() => setStatusFilter('all')}
                  />
                )}
                {stockRange !== 'all' && (
                  <FilterChip
                    label={`Stok: ${STOCK_RANGE_LABELS[stockRange]}`}
                    onRemove={() => setStockRange('all')}
                  />
                )}
                {sortBy !== DEFAULT_SORT && (
                  <FilterChip label={`Sıralama: ${SORT_LABELS[sortBy]}`} onRemove={() => setSortBy(DEFAULT_SORT)} />
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-auto text-[14px] text-[#1863dc] underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6]"
                >
                  Tümünü Temizle
                </button>
              </div>
            </>
          )}
        </div>

        {/* Ürün tablosu */}
        <div className="overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-[#ffffff]">
          {pagedRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Package className="h-8 w-8 text-[#d9d9dd]" />
              <p className="text-[18px] leading-[1.4] text-[#75758a]">
                {hasActiveFilters ? 'Seçili filtrelerle eşleşen ürün bulunamadı.' : 'Henüz ürün bulunamadı.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[14px] font-medium text-[#1863dc] underline-offset-4 hover:underline"
                >
                  Filtreleri temizle
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#ffffff]">
                  <TableRow className="border-b border-[#e5e7eb] hover:bg-transparent">
                    <TableHead className="w-[72px] px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                      Görsel
                    </TableHead>
                    <TableHead className="px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                      Ürün Bilgileri
                    </TableHead>
                    <TableHead className="px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                      Durum
                    </TableHead>
                    <TableHead className="px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                      Toplam Stok
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map(row => {
                    const isZero = row.totalStock === 0;
                    return (
                      <TableRow
                        key={row.productId}
                        className="group cursor-pointer border-b border-[#e5e7eb] transition-colors hover:bg-[#f2f2f2]"
                        onClick={() => {
                          const product = products.find(p => p.id === row.productId);
                          if (product) setSelectedProduct(product);
                        }}
                      >
                        <TableCell className="px-6 py-5 align-top">
                          <ProductThumb src={row.thumbnail} alt={row.productName} />
                        </TableCell>
                        <TableCell className="px-6 py-5 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-[16px] font-medium text-[#17171c] transition-colors group-hover:text-[#1863dc]">
                              {row.productName}
                            </span>
                            <span className="flex items-center gap-2 text-[14px] text-[#75758a]">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d9d9dd]" />
                              {row.variantCount} varyant
                            </span>
                            {row.category && (
                              <span className="mt-1 inline-flex w-fit rounded-full bg-[#f1f5ff] px-2.5 py-0.5 text-[12px] font-medium text-[#1863dc]">
                                {row.category}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-5 align-top">
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="px-6 py-5 align-top">
                          <div className="flex items-baseline gap-2">
                            <span
                              className={`text-[24px] font-medium tracking-[-0.02em] ${isZero ? 'text-[#b30000]' : 'text-[#17171c]'}`}
                            >
                              {row.totalStock}
                            </span>
                            <span className="text-[14px] text-[#75758a]">Adet</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalResults > 0 && (
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-[#75758a]">
              {totalResults} ürün gösteriliyor, {pagedRows.length} tanesi bu sayfada
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setCurrentPage(page - 1)}
                disabled={page <= 1}
                className="h-10 gap-1 rounded-full border border-[#e5e7eb] bg-[#ffffff] px-4 text-[14px] font-medium text-[#17171c] shadow-none transition-colors hover:bg-[#f2f2f2] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Önceki
              </Button>
              <span className="whitespace-nowrap text-[14px] text-[#17171c]">
                Sayfa {page} / {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(page + 1)}
                disabled={page >= totalPages}
                className="h-10 gap-1 rounded-full border border-[#e5e7eb] bg-[#ffffff] px-4 text-[14px] font-medium text-[#17171c] shadow-none transition-colors hover:bg-[#f2f2f2] disabled:opacity-40"
              >
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* En çok satanlar — research-table stili kural ayrımlı liste */}
        {topProducts.length > 0 && (
          <section className="mt-10">
            <MonoLabel className="mb-4">En Çok Satanlar · Son 30 Gün</MonoLabel>
            <div className="overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-[#ffffff]">
              {topProducts.slice(0, 5).map((p, i) => (
                <div
                  key={p.variantId || i}
                  className="flex items-center justify-between gap-4 border-b border-[#e5e7eb] px-6 py-5 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="font-mono text-[14px] tabular-nums text-[#93939f]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate text-[16px] font-medium text-[#17171c]">{p.sku}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-6">
                    <span className="text-[14px] text-[#75758a]">{p.quantity} adet</span>
                    <span className="text-[16px] font-medium tracking-[-0.02em] text-[#17171c]">
                      ₺{p.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Ürün detay modalı */}
      <Dialog open={!!selectedProduct} onOpenChange={open => !open && setSelectedProduct(null)}>
        <DialogContent className="w-[90vw] max-w-5xl gap-0 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-0 shadow-sm sm:max-w-5xl max-sm:left-0 max-sm:top-0 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
          {selectedProduct && (
            <ProductDetailContent
              key={selectedProduct.id}
              product={selectedProduct}
              analytics={analytics}
              lowThreshold={threshold.max}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
