import { useCallback, useMemo, useState } from 'react';
import type { SelectionChange, TableRow } from './types';

export function useRowSelection<T>({
  sortedRows,
  selectedRowIds,
  defaultSelectedRowIds,
  onSelectionChange,
  isDisabled,
}: {
  sortedRows: TableRow<T>[];
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectionChange?: (ids: string[], change: SelectionChange) => void;
  /** Pasif satırlar tümünü-seç dışında kalır. */
  isDisabled?: (entry: TableRow<T>, index: number) => boolean;
}) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(() => new Set(defaultSelectedRowIds));
  const selected = useMemo(
    () => (selectedRowIds !== undefined ? new Set(selectedRowIds) : internalSelected),
    [selectedRowIds, internalSelected],
  );

  const commit = useCallback(
    (next: Set<string>) => {
      if (selectedRowIds === undefined) setInternalSelected(next);
      const added = [...next].filter(id => !selected.has(id));
      const removed = [...selected].filter(id => !next.has(id));
      onSelectionChange?.([...next], { added, removed });
    },
    [selectedRowIds, onSelectionChange, selected],
  );

  const eligible = useMemo(
    () => sortedRows.filter((entry, index) => !isDisabled?.(entry, index)),
    [sortedRows, isDisabled],
  );
  const allSelected = eligible.length > 0 && eligible.every(r => selected.has(r.id));
  const someSelected = eligible.some(r => selected.has(r.id));

  // Hepsi seçiliyse hepsini çıkar; hiçbiri/kısmi ise eksikleri ekle.
  const toggleAll = useCallback(() => {
    const next = new Set(selected);
    if (allSelected) {
      for (const r of eligible) next.delete(r.id);
    } else {
      for (const r of eligible) next.add(r.id);
    }
    commit(next);
  }, [allSelected, eligible, selected, commit]);

  const toggleRow = useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      commit(next);
    },
    [selected, commit],
  );

  return { selected, allSelected, someSelected, toggleAll, toggleRow };
}
