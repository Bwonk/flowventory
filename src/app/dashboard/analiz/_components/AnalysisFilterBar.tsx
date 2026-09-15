'use client';

import React from 'react';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { ExpandableSearch, ToolTrack, ToolTrackDivider } from '@/components/shared/tool-track';
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

/**
 * Kanvasta yüzen analiz filtre yolu (DESIGN.md §5 "Araç yolu"): açılır arama
 * + sınıf/yaş/hız/aksiyon/sıralama segmentleri TEK `bg-muted` yolda; arama
 * açılınca satır kırılmaz, sığmazsa yol kendi içinde kayar. Aktif değer
 * segmentin kendisinde okunur (çip satırı yok); kart yalnız tabloyu tutar.
 */
export const AnalysisFilterBar: React.FC<AnalysisFilterBarProps> = ({ filters }) => {
  const { abc, aging, band, action, query, sortBy } = filters;

  return (
    <ToolTrack role="group" aria-label="Arama ve filtreler" className="mb-3">
      <ExpandableSearch value={query} onChange={filters.setQuery} placeholder="Ürün ara..." aria-label="Ürün ara" />
      <ToolTrackDivider />
      <Dropdown variant="segment" label={<>Sınıf{abc !== 'all' ? `: ${abc}` : ''}</>} active={abc !== 'all'}>
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
        variant="segment"
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
        variant="segment"
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
        variant="segment"
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
        variant="segment"
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
    </ToolTrack>
  );
};
