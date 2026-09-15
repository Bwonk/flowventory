import { useCallback, useMemo, useState } from 'react';
import type { SortCycle, SortState, TableColumn, TableRow } from './types';
import { nextSortState, sortRows } from './utils';

export function useColumnSort<T>({
  rows,
  columns,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  sortCycle = 'toggle',
  clientSort = true,
  locale = 'tr',
}: {
  rows: TableRow<T>[];
  columns: TableColumn<T>[];
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (next: SortState | null, prev: SortState | null) => void;
  sortCycle?: SortCycle;
  clientSort?: boolean;
  locale?: string;
}) {
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort);
  const sort = sortProp !== undefined ? sortProp : internalSort;
  // numeric: "Ürün 2" < "Ürün 10" — addaki sayılar doğal sırada.
  const collator = useMemo(() => new Intl.Collator(locale, { numeric: true }), [locale]);

  const commit = useCallback(
    (next: SortState | null) => {
      if (sortProp === undefined) setInternalSort(next);
      onSortChange?.(next, sort);
    },
    [sortProp, onSortChange, sort],
  );

  const toggleSort = useCallback(
    (key: string) => {
      const column = columns.find(c => c.key === key);
      if (!column) return;
      commit(nextSortState(sort, column, sortCycle));
    },
    [columns, sort, sortCycle, commit],
  );

  const sortedRows = useMemo(() => {
    if (!clientSort || !sort) return rows;
    const column = columns.find(c => c.key === sort.key);
    if (!column) return rows;
    return sortRows(rows, column, sort.direction, collator);
  }, [rows, sort, columns, clientSort, collator]);

  return { sort, sortedRows, toggleSort };
}
