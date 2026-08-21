'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStockThreshold } from '@/lib/stock-threshold';
import type { Product, ProductRow, SortBy, StatusFilter, StockRange, VariantSales } from '@/lib/products/types';
import { DEFAULT_SORT, ITEMS_PER_PAGE } from '@/lib/products/constants';
import { flattenToProducts, filterRows } from '@/lib/products/filtering';

export interface UseProductFilters {
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  query: string;
  setQuery: (value: string) => void;
  stockRange: StockRange;
  setStockRange: (value: StockRange) => void;
  sortBy: SortBy;
  setSortBy: (value: SortBy) => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  totalResults: number;
  displayedRows: ProductRow[];
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
}

export function useProductFilters(
  products: Product[],
  viewStats?: Record<string, number> | null,
  salesByVariant?: VariantSales[],
  initialStatusFilter?: StatusFilter,
): UseProductFilters {
  const { threshold } = useStockThreshold();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter ?? 'all');
  const [query, setQuery] = useState('');
  const [stockRange, setStockRange] = useState<StockRange>('all');
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);

  const productRows = useMemo(
    () => flattenToProducts(products, threshold.min, threshold.max, viewStats, salesByVariant),
    [products, threshold.min, threshold.max, viewStats, salesByVariant],
  );

  const filteredRows = useMemo(
    () => filterRows(productRows, statusFilter, query, stockRange, sortBy),
    [productRows, statusFilter, query, stockRange, sortBy],
  );

  // Reset display count when filters or sorting change.
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
    setLoadingMore(false);
  }, [statusFilter, query, stockRange, sortBy, threshold.min, threshold.max]);

  const totalResults = filteredRows.length;
  const displayedRows = filteredRows.slice(0, displayCount);
  const hasMore = displayCount < filteredRows.length;

  const loadMore = useCallback(() => {
    if (loadingMore || displayCount >= filteredRows.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
      setLoadingMore(false);
    }, 80);
  }, [loadingMore, displayCount, filteredRows.length]);

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
    activeFilterCount,
    hasActiveFilters,
    clearAllFilters,
    totalResults,
    displayedRows,
    hasMore,
    loadMore,
    loadingMore,
  };
}
