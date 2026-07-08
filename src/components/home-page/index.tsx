"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Search,
  TrendingUp,
  TrendingDown,
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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Product = NonNullable<ListProductsApiResponse['products']>[0];
type Variant = Product['variants'][number];

interface VariantRow {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  stock: number;
  price?: number;
  thumbnail?: string;
  category?: string;
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

function getProductStatus(product: Product): 'critical' | 'warning' | 'healthy' {
  let hasWarning = false;
  for (const variant of product.variants) {
    const stock = variant.stocks?.[0]?.stockCount ?? 0;
    if (stock === 0) return 'critical';
    if (stock <= 10) hasWarning = true;
  }
  return hasWarning ? 'warning' : 'healthy';
}

/** Ürünün ilk kategori adını döndürür; kategori yoksa undefined. */
function getProductCategory(product: Product): string | undefined {
  return product.categories?.find(c => !!c.name)?.name ?? undefined;
}

/** Backend'de üretilmiş ikas CDN görsel URL'si; yoksa undefined (placeholder). */
function getVariantThumbnail(variant: Variant): string | undefined {
  return variant.imageUrl ?? undefined;
}

function flattenProducts(products: Product[]): VariantRow[] {
  const rows: VariantRow[] = [];
  for (const product of products) {
    const category = getProductCategory(product);
    if (product.variants.length === 0) {
      rows.push({
        productId: product.id,
        productName: product.name,
        variantId: product.id,
        variantName: '—',
        stock: 0,
        category,
      });
    } else {
      for (const variant of product.variants) {
        const variantName =
          variant.variantValues && variant.variantValues.length > 0
            ? variant.variantValues.map(v => v.variantValueName).join(' / ')
            : variant.sku || 'Varyant';
        rows.push({
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          variantName,
          stock: variant.stocks?.[0]?.stockCount ?? 0,
          price: variant.prices?.[0]?.sellPrice,
          thumbnail: getVariantThumbnail(variant),
          category,
        });
      }
    }
  }
  return rows;
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

function sortRows(rows: VariantRow[], sortBy: SortBy): VariantRow[] {
  const copy = [...rows];
  switch (sortBy) {
    case 'stok-azalan':
      return copy.sort((a, b) => b.stock - a.stock);
    case 'stok-artan':
      return copy.sort((a, b) => a.stock - b.stock);
    case 'isim-az':
      return copy.sort((a, b) => a.productName.localeCompare(b.productName, 'tr'));
    case 'aciliyet':
    default:
      // En düşük stok (en acil) en üstte.
      return copy.sort((a, b) => a.stock - b.stock);
  }
}

function filterRows(
  rows: VariantRow[],
  statusFilter: StatusFilter,
  query: string,
  stockRange: StockRange,
  sortBy: SortBy,
): VariantRow[] {
  const q = query.toLowerCase().trim();
  let filtered = rows;

  // Birincil filtre: stok durumu.
  if (statusFilter === 'tukendi') filtered = filtered.filter(r => r.stock === 0);
  else if (statusFilter === 'az-kalan') filtered = filtered.filter(r => r.stock >= 1 && r.stock <= 10);
  else if (statusFilter === 'saglikli') filtered = filtered.filter(r => r.stock >= 11);

  // İkincil filtre: stok aralığı.
  if (stockRange !== 'all') {
    filtered = filtered.filter(r => matchesStockRange(r.stock, stockRange));
  }

  // Arama filtresi.
  if (q) {
    filtered = filtered.filter(
      r => r.productName.toLowerCase().includes(q) || r.variantName.toLowerCase().includes(q),
    );
  }

  // Sıralama.
  return sortRows(filtered, sortBy);
}

function downloadCSV(rows: VariantRow[]) {
  const headers = ['Ürün Adı', 'Varyant Adı', 'Kategori', 'Stok Adedi', 'Durum'];
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const status = row.stock === 0 ? 'Tükendi' : row.stock <= 10 ? 'Az Kalan' : 'Sağlıklı';
    const cells = [
      `"${row.productName.replace(/"/g, '""')}"`,
      `"${row.variantName.replace(/"/g, '""')}"`,
      `"${(row.category ?? '').replace(/"/g, '""')}"`,
      row.stock,
      status,
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

/** Cohere-token status treatment for a single stock value. */
function stockStatus(stock: number): { label: string; className: string } {
  if (stock === 0) {
    return { label: 'Tükendi', className: 'border border-[#b30000] text-[#b30000] bg-transparent' };
  }
  if (stock <= 10) {
    return { label: 'Az Kalan', className: 'border border-[#ff7759] text-[#ff7759] bg-transparent' };
  }
  return { label: 'Sağlıklı', className: 'border-transparent bg-[#edfce9] text-[#003c33]' };
}

const StatusBadge: React.FC<{ stock: number }> = ({ stock }) => {
  const { label, className } = stockStatus(stock);
  return (
    <Badge className={`rounded-full px-3 py-1 text-[12px] font-medium shadow-none ${className}`}>
      {label}
    </Badge>
  );
};

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

const HomePage: React.FC<HomePageProps> = ({ token, storeName, products = [], analytics, loading }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [stockRange, setStockRange] = useState<StockRange>('all');
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const variantRows = useMemo(() => flattenProducts(products), [products]);

  const filteredRows = useMemo(
    () => filterRows(variantRows, statusFilter, query, stockRange, sortBy),
    [variantRows, statusFilter, query, stockRange, sortBy],
  );

  // Herhangi bir filtre değişince ilk sayfaya dön.
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, query, stockRange, sortBy]);

  const totalProducts = products.length;
  const criticalCount = products.filter(p => getProductStatus(p) === 'critical').length;
  const warningCount = products.filter(p => getProductStatus(p) === 'warning').length;
  const healthyCount = products.filter(p => getProductStatus(p) === 'healthy').length;

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

  const revenueChange = analytics?.revenueChange ?? 0;
  const isPositive = revenueChange >= 0;
  const topProducts = analytics?.topProducts ?? [];

  return (
    <div className="min-h-screen bg-[#ffffff] font-sans text-[#212121]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Başlık */}
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <MonoLabel>Stok Yönetimi</MonoLabel>
            <h1 className="text-5xl font-normal leading-none tracking-[-0.04em] text-[#17171c] sm:text-6xl">
              Stok Takibi
            </h1>
            {storeName && <p className="text-[18px] leading-[1.4] text-[#75758a]">{storeName}</p>}
          </div>
          <Button
            onClick={() => downloadCSV(pagedRows)}
            className="h-auto gap-2 self-start rounded-full bg-[#17171c] px-6 py-3 text-[14px] font-medium text-[#ffffff] shadow-none transition-colors hover:bg-[#000000] sm:self-auto"
          >
            <Download className="h-4 w-4" />
            CSV İndir
          </Button>
        </header>

        {/* Ciro bandı — deep-green dark-feature-band */}
        <section className="mb-6 overflow-hidden rounded-[22px] bg-[#003c33] p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3">
              <MonoLabel className="text-[#edfce9]">30 Günlük Ciro</MonoLabel>
              <p className="text-5xl font-normal leading-none tracking-[-0.03em] text-[#ffffff] sm:text-6xl">
                ₺{analytics?.totalRevenue?.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) ?? '—'}
              </p>
            </div>
            {analytics && (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-medium ${
                    isPositive ? 'bg-[#edfce9] text-[#003c33]' : 'border border-[#ffad9b] text-[#ffad9b]'
                  }`}
                >
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isPositive ? '+' : ''}
                  {revenueChange}%
                </span>
                <span className="text-[14px] leading-[1.4] text-[#d9d9dd]">geçen aya göre</span>
              </div>
            )}
          </div>
        </section>

        {/* Metrik kartları */}
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="rounded-[16px] border-[#e5e7eb] bg-[#ffffff] shadow-none">
            <CardContent className="p-6">
              <MonoLabel className="mb-3">Toplam Ürün</MonoLabel>
              <p className="text-4xl font-normal tracking-[-0.03em] text-[#17171c]">{totalProducts}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[16px] border-[#e5e7eb] bg-[#ffffff] shadow-none">
            <CardContent className="p-6">
              <MonoLabel className="mb-3">Kritik</MonoLabel>
              <p className="text-4xl font-normal tracking-[-0.03em] text-[#b30000]">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[16px] border-[#e5e7eb] bg-[#ffffff] shadow-none">
            <CardContent className="p-6">
              <MonoLabel className="mb-3">Dikkat</MonoLabel>
              <p className="text-4xl font-normal tracking-[-0.03em] text-[#ff7759]">{warningCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[16px] border-[#e5e7eb] bg-[#ffffff] shadow-none">
            <CardContent className="p-6">
              <MonoLabel className="mb-3">Sağlıklı</MonoLabel>
              <p className="text-4xl font-normal tracking-[-0.03em] text-[#003c33]">{healthyCount}</p>
            </CardContent>
          </Card>
        </div>

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

          {/* Satır 2: aktif filtre çipleri — yalnızca en az bir filtre etkinse görünür */}
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
                      Güncel Stok
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row, index) => {
                    const isZero = row.stock === 0;
                    return (
                      <TableRow
                        key={`${row.variantId}-${startIndex + index}`}
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
                              {row.variantName}
                            </span>
                            {row.category && (
                              <span className="mt-1 inline-flex w-fit rounded-full bg-[#f1f5ff] px-2.5 py-0.5 text-[12px] font-medium text-[#1863dc]">
                                {row.category}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-5 align-top">
                          <StatusBadge stock={row.stock} />
                        </TableCell>
                        <TableCell className="px-6 py-5 align-top">
                          <div className="flex items-baseline gap-2">
                            <span
                              className={`text-[24px] font-medium tracking-[-0.02em] ${isZero ? 'text-[#b30000]' : 'text-[#17171c]'}`}
                            >
                              {row.stock}
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

      {/* Ürün detay dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={open => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl overflow-hidden rounded-[16px] border-[#e5e7eb] bg-[#ffffff] p-0">
          <DialogHeader className="border-b border-[#e5e7eb] p-6">
            <MonoLabel className="mb-2">Ürün Detayı</MonoLabel>
            <DialogTitle className="text-[32px] font-normal leading-[1.2] tracking-[-0.03em] text-[#17171c]">
              {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {selectedProduct?.variants && selectedProduct.variants.length > 0 ? (
              <div className="overflow-hidden rounded-[8px] border border-[#e5e7eb]">
                <Table>
                  <TableHeader className="bg-[#eeece7]">
                    <TableRow className="border-b border-[#e5e7eb] hover:bg-transparent">
                      <TableHead className="w-[64px] px-5 py-4 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                        Görsel
                      </TableHead>
                      <TableHead className="px-5 py-4 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                        Varyant
                      </TableHead>
                      <TableHead className="px-5 py-4 text-right font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                        Fiyat
                      </TableHead>
                      <TableHead className="px-5 py-4 text-right font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                        Stok
                      </TableHead>
                      <TableHead className="px-5 py-4 text-right font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                        Durum
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProduct.variants.map((v, i) => {
                      const vName = v.variantValues?.length
                        ? v.variantValues.map(val => val.variantValueName).join(' / ')
                        : v.sku || 'Varsayılan';
                      const stockCount = v.stocks?.[0]?.stockCount ?? 0;
                      const price = v.prices?.[0]?.sellPrice ?? 0;
                      const isZero = stockCount === 0;

                      return (
                        <TableRow
                          key={v.id || i}
                          className="border-b border-[#e5e7eb] transition-colors last:border-b-0 hover:bg-[#f2f2f2]"
                        >
                          <TableCell className="px-5 py-4 align-middle">
                            <ProductThumb src={getVariantThumbnail(v)} alt={vName} />
                          </TableCell>
                          <TableCell className="px-5 py-4 font-medium text-[#17171c]">{vName}</TableCell>
                          <TableCell className="px-5 py-4 text-right text-[#75758a]">
                            ₺{price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell
                            className={`px-5 py-4 text-right font-medium ${isZero ? 'text-[#b30000]' : 'text-[#17171c]'}`}
                          >
                            {stockCount}
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <StatusBadge stock={stockCount} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-[16px] leading-[1.5] text-[#75758a]">Bu ürünün varyantı bulunmamaktadır.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
