'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  totalResults: number;
  displayedRows: ProductRow[];
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
}

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
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);

  const productRows = useMemo(
    () => flattenToProducts(products, threshold.min, threshold.max, viewStats, topProducts),
    [products, threshold.min, threshold.max, viewStats, topProducts],
  );

  const filteredRows = useMemo(
    () => filterRows(productRows, statusFilter, query, stockRange, sortBy),
    [productRows, statusFilter, query, stockRange, sortBy],
  );

  const viewFilteredRows = useMemo(() => {
    if (viewMode !== 'dead') return filteredRows;
    return filteredRows.filter(
      r => r.daysRemaining == null || (r.daysRemaining != null && r.daysRemaining > 180),
    );
  }, [filteredRows, viewMode]);

  // Reset display count when filters or sorting change.
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
    setLoadingMore(false);
  }, [statusFilter, query, stockRange, sortBy, threshold.min, threshold.max, viewMode]);

  const totalResults = viewFilteredRows.length;
  const displayedRows = viewFilteredRows.slice(0, displayCount);
  const hasMore = displayCount < viewFilteredRows.length;

  const loadMore = useCallback(() => {
    if (loadingMore || displayCount >= viewFilteredRows.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
      setLoadingMore(false);
    }, 80);
  }, [loadingMore, displayCount, viewFilteredRows.length]);

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
    totalResults,
    displayedRows,
    hasMore,
    loadMore,
    loadingMore,
  };
}
