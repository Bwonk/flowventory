'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { SortBy, StatusFilter, StockRange } from '../types';
import {
  DEFAULT_SORT,
  SORT_LABELS,
  SORT_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  STOCK_RANGE_LABELS,
  STOCK_RANGE_OPTIONS,
} from '../constants';
import { Dropdown, OptionButton } from './Dropdown';
import { ThresholdControl } from './ThresholdControl';
import { FilterChip } from './atoms';

interface FilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  stockRange: StockRange;
  onStockRangeChange: (value: StockRange) => void;
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

/** Birleşik filtre konteyneri: arama, durum/stok aralığı/sıralama/stok eşiği + aktif çipler. */
export const FilterBar: React.FC<FilterBarProps> = ({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  stockRange,
  onStockRangeChange,
  sortBy,
  onSortByChange,
  hasActiveFilters,
  onClearAll,
}) => (
  <div className="mb-8 rounded-[12px] border border-[#e5e7eb] bg-[#ffffff]">
    {/* Satır 1: arama solda, filtre dropdown'ları sağda */}
    <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93939f]" />
        <Input
          placeholder="Ürün veya varyant ara..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
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
                  onStatusFilterChange(o.value);
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
                  onStockRangeChange(o.value);
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
                  onSortByChange(o.value);
                  close();
                }}
              />
            ))
          }
        </Dropdown>

        {/* Stok Eşiği */}
        <ThresholdControl />
      </div>
    </div>

    {hasActiveFilters && (
      <>
        <div className="h-px w-full bg-[#e5e7eb]" />
        <div className="flex flex-wrap items-center gap-2 p-3">
          {query.trim() !== '' && (
            <FilterChip label={`Arama: “${query.trim()}”`} onRemove={() => onQueryChange('')} />
          )}
          {statusFilter !== 'all' && (
            <FilterChip
              label={`Durum: ${STATUS_LABELS[statusFilter]}`}
              onRemove={() => onStatusFilterChange('all')}
            />
          )}
          {stockRange !== 'all' && (
            <FilterChip
              label={`Stok: ${STOCK_RANGE_LABELS[stockRange]}`}
              onRemove={() => onStockRangeChange('all')}
            />
          )}
          {sortBy !== DEFAULT_SORT && (
            <FilterChip label={`Sıralama: ${SORT_LABELS[sortBy]}`} onRemove={() => onSortByChange(DEFAULT_SORT)} />
          )}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto text-[14px] text-[#1863dc] underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6]"
          >
            Tümünü Temizle
          </button>
        </div>
      </>
    )}
  </div>
);
