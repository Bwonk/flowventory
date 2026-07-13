import { ListProductsApiResponse } from '@/app/api/ikas/list-products/route';
import { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';

export type Product = NonNullable<ListProductsApiResponse['products']>[0];
export type Variant = Product['variants'][number];
export type ProductStatus = 'critical' | 'warning' | 'healthy';

export interface ProductRow {
  productId: string;
  productName: string;
  category?: string;
  thumbnail?: string;
  status: ProductStatus;
  totalStock: number;
  variantCount: number;
  viewCount?: number;
  daysRemaining?: number | null;
}

export type ViewMode = 'normal' | 'dead';

export interface HomePageProps {
  token: string | null;
  storeName?: string;
  products: Product[];
  analytics: AnalyticsApiResponse | null;
  viewStats?: Record<string, number> | null;
  loading: boolean;
  initialStatusFilter?: StatusFilter;
  initialViewMode?: ViewMode;
}

export type StatusFilter = 'all' | 'tukendi' | 'az-kalan' | 'saglikli';
export type StockRange = 'all' | '0' | '1-10' | '11-50' | '51-100' | '100+';
export type SortBy = 'aciliyet' | 'stok-omru' | 'stok-azalan' | 'stok-artan' | 'isim-az';

export type ChartRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ChartMetric = 'revenue' | 'quantity' | 'views';

export interface DaySeriesPoint {
  date: string;
  revenue: number;
  units: number;
  views: number;
}

export type TopProduct = AnalyticsApiResponse['topProducts'][number];
