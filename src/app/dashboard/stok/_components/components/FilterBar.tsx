'use client';

import React from 'react';
import type { SortBy, StatusFilter, StockRange } from '@/lib/products/types';
import {
  DEFAULT_SORT,
  SORT_LABELS,
  SORT_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  STOCK_RANGE_LABELS,
  STOCK_RANGE_OPTIONS,
} from '@/lib/products/constants';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { ExpandableSearch, ToolTrack, ToolTrackDivider } from '@/components/shared/tool-track';
import { ThresholdControl } from './ThresholdControl';

interface FilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  stockRange: StockRange;
  onStockRangeChange: (value: StockRange) => void;
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
}

/**
 * Kanvasta yüzen filtre yolu (DESIGN.md §5 "Araç yolu", rapor sayfasıyla aynı
 * dil): açılır arama + durum/stok aralığı/sıralama/eşik segmentleri TEK
 * `bg-muted` yolda — arama açılınca filtreler aynı yolda kayar, satır
 * kırılmaz; sığmazsa yol kendi içinde kayar. Aktif değer segmentin kendisinde
 * okunur (çip satırı yok — kullanıcı kararı); kart yalnız tabloyu tutar.
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  stockRange,
  onStockRangeChange,
  sortBy,
  onSortByChange,
}) => (
  <ToolTrack role="group" aria-label="Arama ve filtreler" className="mb-3">
    <ExpandableSearch
      value={query}
      onChange={onQueryChange}
      placeholder="Ürün veya varyant ara..."
      aria-label="Ürün veya varyant ara"
    />
    <ToolTrackDivider />
    {/* Durum */}
    <Dropdown variant="segment" label={<>Durum: {STATUS_LABELS[statusFilter]}</>} active={statusFilter !== 'all'}>
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
      variant="segment"
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
    <Dropdown
      variant="segment"
      label={<>Sıralama: {SORT_LABELS[sortBy]}</>}
      active={sortBy !== DEFAULT_SORT}
      align="end"
    >
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
  </ToolTrack>
);
