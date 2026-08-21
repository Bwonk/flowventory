'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InventoryInsightItem } from '@/app/api/insights/inventory/route';
import { deriveAction, type ActionKey } from '@/lib/reports/actions';
import {
  DEFAULT_ANALYSIS_SORT,
  type AbcFilter,
  type ActionFilter,
  type AgingFilter,
  type AnalysisMetric,
  type AnalysisSortBy,
  type BandFilter,
} from '../constants';

const ITEMS_PER_PAGE = 20;

export interface AnalysisInitialFilters {
  abc?: AbcFilter;
  aging?: AgingFilter;
  band?: BandFilter;
  action?: ActionFilter;
}

export interface UseAnalysisFilters {
  abc: AbcFilter;
  setAbc: (value: AbcFilter) => void;
  aging: AgingFilter;
  setAging: (value: AgingFilter) => void;
  band: BandFilter;
  setBand: (value: BandFilter) => void;
  action: ActionFilter;
  setAction: (value: ActionFilter) => void;
  query: string;
  setQuery: (value: string) => void;
  sortBy: AnalysisSortBy;
  setSortBy: (value: AnalysisSortBy) => void;
  /** productId → aksiyon (panel ve tablo aynı haritayı kullanır). */
  actionByProduct: Map<string, ActionKey | null>;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  totalResults: number;
  displayedRows: InventoryInsightItem[];
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
}

/**
 * Analiz tablosunun filtre/sıralama/sayfalama state'i — use-product-filters aynası.
 * Aksiyon üyeliği deriveAction'dan gelir; panel kartlarıyla tablo filtresi böylece
 * hiçbir zaman farklı sonuç göstermez.
 */
export function useAnalysisFilters(
  items: InventoryInsightItem[],
  targetStockDays: number,
  metric: AnalysisMetric,
  initial?: AnalysisInitialFilters,
): UseAnalysisFilters {
  const [abc, setAbc] = useState<AbcFilter>(initial?.abc ?? 'all');
  const [aging, setAging] = useState<AgingFilter>(initial?.aging ?? 'all');
  const [band, setBand] = useState<BandFilter>(initial?.band ?? 'all');
  const [action, setAction] = useState<ActionFilter>(initial?.action ?? 'all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<AnalysisSortBy>(DEFAULT_ANALYSIS_SORT);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);

  const actionByProduct = useMemo(() => {
    const map = new Map<string, ActionKey | null>();
    for (const item of items) {
      map.set(item.productId, deriveAction(item, { targetStockDays }));
    }
    return map;
  }, [items, targetStockDays]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const rows = items.filter(item => {
      const itemClass = metric === 'kar' ? item.profitAbcClass : item.abcClass;
      if (abc !== 'all' && itemClass !== abc) return false;
      // Yaşlandırma kovaları özet kartlarıyla tutarlı: stoksuz ürünler kova dışı.
      if (aging !== 'all' && (item.agingBucket !== aging || item.totalStock === 0)) return false;
      if (band !== 'all' && item.sellThroughBand !== band) return false;
      if (action !== 'all' && actionByProduct.get(item.productId) !== action) return false;
      if (q && !item.productName.toLocaleLowerCase('tr').includes(q)) return false;
      return true;
    });

    const sorted = [...rows];
    switch (sortBy) {
      case 'kar':
        sorted.sort((a, b) => b.profit - a.profit);
        break;
      case 'sermaye':
        sorted.sort((a, b) => b.stockValue - a.stockValue);
        break;
      case 'satis':
        sorted.sort((a, b) => b.soldQty - a.soldQty);
        break;
      case 'stok-omru':
        // Uzun → kısa; satışsızlar (null) fiilen sonsuz ömür → en başta.
        sorted.sort((a, b) => (b.daysOfStock ?? Infinity) - (a.daysOfStock ?? Infinity));
        break;
      case 'ciro':
      default:
        sorted.sort((a, b) => b.revenue - a.revenue);
        break;
    }
    return sorted;
  }, [items, abc, aging, band, action, query, sortBy, metric, actionByProduct]);

  // Filtre/sıralama/metrik değişince sayfalamayı başa sar.
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
    setLoadingMore(false);
  }, [abc, aging, band, action, query, sortBy, metric]);

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
    (abc !== 'all' ? 1 : 0) +
    (aging !== 'all' ? 1 : 0) +
    (band !== 'all' ? 1 : 0) +
    (action !== 'all' ? 1 : 0) +
    (sortBy !== DEFAULT_ANALYSIS_SORT ? 1 : 0) +
    (query.trim() !== '' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setAbc('all');
    setAging('all');
    setBand('all');
    setAction('all');
    setQuery('');
    setSortBy(DEFAULT_ANALYSIS_SORT);
  };

  return {
    abc,
    setAbc,
    aging,
    setAging,
    band,
    setBand,
    action,
    setAction,
    query,
    setQuery,
    sortBy,
    setSortBy,
    actionByProduct,
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
