import type { ReactNode } from 'react';
import type { Align, CellContext, SortCycle, SortDirection, SortState, SortValue, TableColumn, TableRow } from './types';

/** Checkbox kolonu: `pl-5` + 16px kutu + `pr-0` ≈ 40px (rapor'daki `w-10`). */
export const CHECKBOX_PX = 40;
export const CHECKBOX_WIDTH = `${CHECKBOX_PX}px`;

/** Satır menüsü kolonu: RowActions içinde tek ikon-buton. */
export const MENU_COLUMN_PX = 56;
export const MENU_COLUMN_KEY = '__row-menu';

/** Tailwind'in rem ölçeğinin varsaydığı kök font boyutu. */
export const DEFAULT_ROOT_FONT_SIZE = 16;

export function effectiveAlign<T>(column: Pick<TableColumn<T>, 'align' | 'numeric'>): Align {
  if (column.numeric) return 'right';
  return column.align ?? 'left';
}

export function alignText(align: Align): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export function alignFlex(align: Align): string {
  if (align === 'right') return 'justify-end';
  if (align === 'center') return 'justify-center';
  return 'justify-start';
}

/**
 * Kenar boşluğu türetilir: kartın ilk/son kolonu `px-5`, aradakiler `px-3`
 * (DESIGN.md §5). Checkbox kolonu varsa veri kolonlarının ilki kenar sayılmaz.
 * Yazdırmada gizlenen kolonlar atlanıp kenar yeniden hesaplanır.
 */
export function cellPadding<T>(columns: Pick<TableColumn<T>, 'printHidden'>[], index: number, leadingSelection: boolean): string {
  const first = index === 0 && !leadingSelection;
  const last = index === columns.length - 1;
  const printable = columns.map((c, i) => (c.printHidden ? -1 : i)).filter(i => i >= 0);
  const printFirst = printable[0] === index && !first;
  const printLast = printable[printable.length - 1] === index && !last;
  return [
    first ? 'pl-5' : 'pl-3',
    last ? 'pr-5' : 'pr-3',
    printFirst ? 'print:pl-5' : undefined,
    printLast ? 'print:pr-5' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

export function readCell<T>(row: T, column: TableColumn<T>, ctx: CellContext): ReactNode {
  if (column.cell) return column.cell(row, ctx);
  return (row as Record<string, ReactNode>)[column.key];
}

export function readSortValue<T>(row: T, column: TableColumn<T>): SortValue {
  if (column.sortValue) return column.sortValue(row);
  return (row as Record<string, SortValue>)[column.key];
}

export function isEmptySortValue(value: SortValue): boolean {
  return value == null || value === '' || (typeof value === 'number' && Number.isNaN(value));
}

/** İki dolu değer: sayılar farkla, gerisi collator ile (`tr`: ç>c, İ/ı doğru). */
export function compareSortValues(a: SortValue, b: SortValue, collator: Intl.Collator): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** Kararlı sıralama; boş değerler yönden bağımsız en sonda. */
export function sortRows<T>(
  rows: TableRow<T>[],
  column: TableColumn<T>,
  direction: SortDirection,
  collator: Intl.Collator,
): TableRow<T>[] {
  const dir = direction === 'asc' ? 1 : -1;
  return rows
    .map((entry, index) => ({ entry, index, value: readSortValue(entry.row, column) }))
    .sort((a, b) => {
      const aEmpty = isEmptySortValue(a.value);
      const bEmpty = isEmptySortValue(b.value);
      if (aEmpty && bEmpty) return a.index - b.index;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      const cmp = compareSortValues(a.value, b.value, collator) * dir;
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map(item => item.entry);
}

/** Başlığa tıklanınca sonraki sıralama durumu. */
export function nextSortState<T>(
  current: SortState | null,
  column: Pick<TableColumn<T>, 'key' | 'defaultDirection'>,
  cycle: SortCycle,
): SortState | null {
  const natural = column.defaultDirection ?? 'asc';
  if (!current || current.key !== column.key) return { key: column.key, direction: natural };
  if (cycle === 'toggle') return { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  // cycle: doğal → tersi → yok
  if (current.direction === natural) return { key: column.key, direction: natural === 'asc' ? 'desc' : 'asc' };
  return null;
}

/**
 * Kayıtlı sırayı uygular; sonradan eklenen kolon `columns` içindeki yerine
 * (sol komşusunun ardına) girer, kaldırılan düşer.
 */
export function applyColumnOrder<T extends { key: string }>(order: string[], columns: T[]): T[] {
  const byKey = new Map(columns.map(c => [c.key, c]));
  const resultKeys = order.filter(k => byKey.has(k));
  const present = new Set(resultKeys);
  columns.forEach((column, i) => {
    if (present.has(column.key)) return;
    let at = resultKeys.length;
    if (i === 0) {
      at = 0;
    } else {
      const idx = resultKeys.indexOf(columns[i - 1].key);
      at = idx === -1 ? i : idx + 1;
    }
    resultKeys.splice(at, 0, column.key);
    present.add(column.key);
  });
  return resultKeys.map(k => byKey.get(k)).filter((c): c is T => c !== undefined);
}

/** Sürüklenen kolonu bırakma indeksine taşır. */
export function moveColumnKey(keys: string[], dragKey: string, dropIndex: number): string[] {
  const from = keys.indexOf(dragKey);
  if (from === -1) return keys;
  const without = keys.filter((_, i) => i !== from);
  let to = dropIndex;
  if (from < to) to -= 1;
  without.splice(to, 0, dragKey);
  return without;
}

/** Mutlak genişlik (px/rem) → px; `%`, `fr`, `auto` gibi paylaşımlı değerler null. */
export function resolveColumnWidth(width: string | undefined, rootFontSize: number): number | null {
  if (!width) return null;
  const value = Number.parseFloat(width);
  if (!Number.isFinite(value)) return null;
  if (width.endsWith('px')) return value;
  if (width.endsWith('rem')) return value * rootFontSize;
  return null;
}

/**
 * `table-layout: fixed` dar konteynerde kolonları sıfıra sıkıştırır; tablo
 * kolonların istediği toplamda tabanlanır, gerisi yatay kayar.
 */
export function minTableWidth<T>(
  columns: Pick<TableColumn<T>, 'key' | 'width' | 'minWidth'>[],
  widths: Record<string, number>,
  options: { leading: number; minColumnWidth: number; rootFontSize: number },
): number {
  const total = columns.reduce((sum, column) => {
    const resized = widths[column.key];
    if (resized != null) return sum + resized;
    const declared = resolveColumnWidth(column.width, options.rootFontSize);
    if (declared != null) return sum + declared;
    return sum + Math.max(options.minColumnWidth, column.minWidth ?? 0);
  }, options.leading);
  return Math.round(total);
}
