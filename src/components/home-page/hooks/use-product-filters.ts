'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStockThreshold } from '@/lib/stock-threshold';
import type { Product, ProductRow, SortBy, StatusFilter, StockRange, TopProduct } from '../types';
import { DEFAULT_SORT, ITEMS_PER_PAGE } from '../constants';
import { flattenToProducts, filterRows } from '../lib/filtering';

export type ViewMode = 'normal' | 'dead';

export interface UseProductFilters {
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  query: string;
  setQuery: (value: string) => void;
  stockRange: StockRange;
  setStockRange: (value: StockRange) => void;
  sortBy: SortBy;
  setSortBy: (value: SortBy) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  page: number;
  totalPages: number;
  totalResults: number;
  pagedRows: ProductRow[];
  setPage: (value: number) => void;
}

/**
 * Stok listesi için filtre/sıralama/sayfalama durumunu ve türetilmiş satırları yönetir.
 * Eşik (min/max) doğrudan useStockThreshold'dan okunur; böylece tüketici bileşenler
 * eşik prop'u taşımak zorunda kalmaz.
 */
export function useProductFilters(
  products: Product[],
  viewStats?: Record<string, number> | null,
  topProducts?: TopProduct[],
  initialStatusFilter?: StatusFilter,
  initialViewMode?: ViewMode,
): UseProductFilters {
  const { threshold } = useStockThreshold();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter ?? 'all');
  const [query, setQuery] = useState('');
  const [stockRange, setStockRange] = useState<StockRange>('all');
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? 'normal');
  const [currentPage, setCurrentPage] = useState(1);

  const productRows = useMemo(
    () => flattenToProducts(products, threshold.min, threshold.max, viewStats, topProducts),
    [products, threshold.min, threshold.max, viewStats, topProducts],
  );

  const filteredRows = useMemo(
    () => filterRows(productRows, statusFilter, query, stockRange, sortBy),
    [productRows, statusFilter, query, stockRange, sortBy],
  );

  // View mode post-filter: 'dead' → satışı olmayan veya stok ömrü >180 gün olan ürünler.
  const viewFilteredRows = useMemo(() => {
    if (viewMode !== 'dead') return filteredRows;
    return filteredRows.filter(
      r => r.daysRemaining == null || (r.daysRemaining != null && r.daysRemaining > 180),
    );
  }, [filteredRows, viewMode]);

  // Herhangi bir filtre veya eşik değişince ilk sayfaya dön.
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, query, stockRange, sortBy, threshold.min, threshold.max, viewMode]);

  // Pagination (client-side).
  const totalResults = viewFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pagedRows = viewFilteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (stockRange !== 'all' ? 1 : 0) +
    (sortBy !== DEFAULT_SORT ? 1 : 0) +
    (query.trim() !== '' ? 1 : 0) +
    (viewMode !== 'normal' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setStatusFilter('all');
    setQuery('');
    setStockRange('all');
    setSortBy(DEFAULT_SORT);
    setViewMode('normal');
    setCurrentPage(1);
  };

  return {
    statusFilter,
    setStatusFilter,
    query,
    setQuery,
    stockRange,
    setStockRange,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    activeFilterCount,
    hasActiveFilters,
    clearAllFilters,
    page,
    totalPages,
    totalResults,
    pagedRows,
    setPage: setCurrentPage,
  };
}
