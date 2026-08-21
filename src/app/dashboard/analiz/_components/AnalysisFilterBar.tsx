'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { FilterChip } from '@/components/shared/filters/atoms';
import {
  ABC_FILTER_OPTIONS,
  ACTION_FILTER_OPTIONS,
  ACTION_LABELS,
  AGING_FILTER_LABEL,
  AGING_FILTER_OPTIONS,
  ANALYSIS_SORT_LABELS,
  ANALYSIS_SORT_OPTIONS,
  BAND_FILTER_OPTIONS,
  DEFAULT_ANALYSIS_SORT,
  SELL_THROUGH_BAND_LABEL,
} from './constants';
import type { UseAnalysisFilters } from './hooks/use-analysis-filters';

interface AnalysisFilterBarProps {
  filters: UseAnalysisFilters;
}

/** Analiz tablosu filtre şeridi: arama + sınıf/yaş/hız/aksiyon dropdown'ları + aktif çipler. */
export const AnalysisFilterBar: React.FC<AnalysisFilterBarProps> = ({ filters }) => {
  const { abc, aging, band, action, query, sortBy } = filters;

  return (
    <div className="border-b border-border">
      {/* Satır 1: arama solda, filtre dropdown'ları sağda */}
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ürün ara..."
            value={query}
            onChange={e => filters.setQuery(e.target.value)}
            className="h-10 w-full border-0 bg-transparent pl-10 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap sm:border-l sm:border-border sm:pl-2">
          <Dropdown label={<>Sınıf{abc !== 'all' ? `: ${abc}` : ''}</>} active={abc !== 'all'}>
            {close =>
              ABC_FILTER_OPTIONS.map(o => (
                <OptionButton
                  key={o.value}
                  label={o.label}
                  selected={abc === o.value}
                  onClick={() => {
                    filters.setAbc(o.value);
                    close();
                  }}
                />
              ))
            }
          </Dropdown>

          <Dropdown
            label={<>Yaş{aging !== 'all' ? `: ${AGING_FILTER_LABEL(aging)}` : ''}</>}
            active={aging !== 'all'}
          >
            {close =>
              AGING_FILTER_OPTIONS.map(o => (
                <OptionButton
                  key={o.value}
                  label={o.label}
                  selected={aging === o.value}
                  onClick={() => {
                    filters.setAging(o.value);
                    close();
                  }}
                />
              ))
            }
          </Dropdown>

          <Dropdown
            label={<>Hız{band !== 'all' ? `: ${SELL_THROUGH_BAND_LABEL[band]}` : ''}</>}
            active={band !== 'all'}
          >
            {close =>
              BAND_FILTER_OPTIONS.map(o => (
                <OptionButton
                  key={o.value}
                  label={o.label}
                  selected={band === o.value}
                  onClick={() => {
                    filters.setBand(o.value);
                    close();
                  }}
                />
              ))
            }
          </Dropdown>

          <Dropdown
            label={<>Aksiyon{action !== 'all' ? `: ${ACTION_LABELS[action]}` : ''}</>}
            active={action !== 'all'}
          >
            {close =>
              ACTION_FILTER_OPTIONS.map(o => (
                <OptionButton
                  key={o.value}
                  label={o.label}
                  selected={action === o.value}
                  onClick={() => {
                    filters.setAction(o.value);
                    close();
                  }}
                />
              ))
            }
          </Dropdown>

          <Dropdown
            label={<>Sıralama: {ANALYSIS_SORT_LABELS[sortBy]}</>}
            active={sortBy !== DEFAULT_ANALYSIS_SORT}
            align="end"
          >
            {close =>
              ANALYSIS_SORT_OPTIONS.map(o => (
                <OptionButton
                  key={o.value}
                  label={o.label}
                  selected={sortBy === o.value}
                  onClick={() => {
                    filters.setSortBy(o.value);
                    close();
                  }}
                />
              ))
            }
          </Dropdown>
        </div>
      </div>

      {filters.hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
          {abc !== 'all' && <FilterChip label={`Sınıf: ${abc}`} onRemove={() => filters.setAbc('all')} />}
          {aging !== 'all' && (
            <FilterChip label={`Yaş: ${AGING_FILTER_LABEL(aging)}`} onRemove={() => filters.setAging('all')} />
          )}
          {band !== 'all' && (
            <FilterChip label={`Hız: ${SELL_THROUGH_BAND_LABEL[band]}`} onRemove={() => filters.setBand('all')} />
          )}
          {action !== 'all' && (
            <FilterChip label={`Aksiyon: ${ACTION_LABELS[action]}`} onRemove={() => filters.setAction('all')} />
          )}
          {query.trim() !== '' && <FilterChip label={`Arama: ${query}`} onRemove={() => filters.setQuery('')} />}
          {sortBy !== DEFAULT_ANALYSIS_SORT && (
            <FilterChip
              label={`Sıralama: ${ANALYSIS_SORT_LABELS[sortBy]}`}
              onRemove={() => filters.setSortBy(DEFAULT_ANALYSIS_SORT)}
            />
          )}
          <button
            type="button"
            onClick={filters.clearAllFilters}
            className="ml-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Tümünü temizle
          </button>
        </div>
      )}
    </div>
  );
};
