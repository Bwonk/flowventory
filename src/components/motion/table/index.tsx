'use client';
// beui.dev/components/motion/table — Flowventory uyarlaması (DESIGN.md §5
// "Liste kalıbı"). Kaynaktan farklar: kendi çerçevesi/zemini yok (TableSection
// kartında yaşar); sabit yükseklikli viewport yerine sayfa kaydırıcısı
// (sidebar-inset) üzerinde sanal liste (80+ satır, yazdırmada kapalı); başlık
// mono mikro-etiket, akışta (sticky yok); satır py-2.5, hover bg-muted/40, seçili
// satır zemin değiştirmez (yalnız tik), pending opacity-60; seçim kutusu AnimatedCheckbox (spring 350/35);
// sıralama asc↔desc, ok mutlak konumlu, sıralanan kolon vurgulanmaz; resize
// tutamacı hairline/ink, bırakma göstergesi ink; portal hap, gölge, motion
// scale yok; menüler DropdownMenu; kenar boşluğu türetilir (px-5/px-3);
// onEndReached yok — sonsuz kaydırma InfiniteScrollFooter'da kalır.

import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCheckbox } from '@/components/shared/AnimatedCheckbox';
import { RowActions } from '@/components/shared/data-table/RowActions';
import { cn } from '@/lib/utils';
import { EditableCell } from './editable-cell';
import { SkeletonRows } from './skeleton-rows';
import { TableHeader } from './table-header';
import { TableMenu } from './table-menu';
import type { HeaderCellRefs, TableColumn, TableProps, TableRow } from './types';
import { useColumnReorder } from './use-column-reorder';
import { useColumnResize } from './use-column-resize';
import { useColumnSort } from './use-column-sort';
import { useRowSelection } from './use-row-selection';
import { useScrollParent } from './use-scroll-parent';
import {
  alignText,
  cellPadding,
  CHECKBOX_PX,
  CHECKBOX_WIDTH,
  DEFAULT_ROOT_FONT_SIZE,
  effectiveAlign,
  MENU_COLUMN_KEY,
  MENU_COLUMN_PX,
  minTableWidth,
  readCell,
} from './utils';

export type {
  CellContext,
  RowState,
  SelectionChange,
  SortCycle,
  SortDirection,
  SortState,
  SortValue,
  TableColumn,
  TableMenuItem,
  TableProps,
} from './types';
export { TableMenu } from './table-menu';

/** 1rem'in px karşılığı: sunucu ve hidrasyon 16 varsayar, sonra bir kez ölçülür. */
function useRootFontSize() {
  const [size, setSize] = useState(DEFAULT_ROOT_FONT_SIZE);
  useEffect(() => {
    const measured = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (measured > 0) setSize(measured);
  }, []);
  return size;
}

const CELL_BASE = 'border-b border-border py-2.5 align-middle group-last:border-b-0';

export function Table<T>({
  data,
  columns,
  getRowId,
  rowHeight = 41,
  onRowClick,
  rowState,
  selectable = false,
  selectedRowIds,
  defaultSelectedRowIds,
  onSelectionChange,
  selectionLabel,
  selectAllLabel = 'Hepsini seç',
  selectAllTitle,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  sortCycle = 'toggle',
  clientSort = true,
  locale = 'tr',
  resizable = false,
  minColumnWidth = 64,
  onColumnResize,
  reorderable = false,
  onColumnOrderChange,
  onCellEdit,
  onColumnRename,
  rowMenu,
  columnMenu,
  scrollMode = 'page',
  height = 440,
  virtualizeThreshold = 80,
  overscan = 8,
  loading = false,
  skeletonRows = 6,
  emptyState,
  hideHeader = false,
  className,
  theadClassName,
  cellClassName,
}: TableProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const thRefs: HeaderCellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const rootFontSize = useRootFontSize();

  const rows = useMemo<TableRow<T>[]>(() => data.map((row, index) => ({ row, id: getRowId(row, index) })), [data, getRowId]);

  const { orderedColumns, dragKey, dropIndex, startReorder, moveReorder, endReorder } = useColumnReorder({
    columns,
    thRefs,
    onColumnOrderChange,
  });

  // Satır menüsü kolonu sıralamaya girmez, hep sondadır.
  const renderColumns = useMemo<TableColumn<T>[]>(() => {
    if (!rowMenu) return orderedColumns;
    const menuColumn: TableColumn<T> = {
      key: MENU_COLUMN_KEY,
      header: <span className="sr-only">İşlem</span>,
      width: `${MENU_COLUMN_PX}px`,
      align: 'right',
      printHidden: true,
      cell: (row, ctx) => (
        <RowActions>
          <TableMenu ariaLabel={`Satır ${ctx.index + 1} seçenekleri`} items={rowMenu(row, ctx.index)} />
        </RowActions>
      ),
    };
    return [...orderedColumns, menuColumn];
  }, [orderedColumns, rowMenu]);

  const { sort, sortedRows, toggleSort } = useColumnSort({
    rows,
    columns,
    sort: sortProp,
    defaultSort,
    onSortChange,
    sortCycle,
    clientSort,
    locale,
  });

  const { widths, startResize, moveResize, endResize } = useColumnResize({
    orderedColumns: renderColumns,
    thRefs,
    minColumnWidth,
    onColumnResize,
  });

  const isDisabled = useCallback(
    (entry: TableRow<T>, index: number) => Boolean(rowState?.(entry.row, index)?.disabled),
    [rowState],
  );
  const { selected, allSelected, someSelected, toggleAll, toggleRow } = useRowSelection({
    sortedRows,
    selectedRowIds,
    defaultSelectedRowIds,
    onSelectionChange,
    isDisabled,
  });

  const { scroller, scrollMargin, overflowing, printing } = useScrollParent(rootRef, scrollMode);

  const virtual = !printing && scroller !== null && sortedRows.length >= virtualizeThreshold;
  const virtualizer = useVirtualizer({
    count: virtual ? sortedRows.length : 0,
    getScrollElement: () => scroller,
    estimateSize: () => rowHeight,
    overscan,
    scrollMargin,
    getItemKey: index => sortedRows[index]?.id ?? index,
    // Satır ölçümü commit sırasında (ref) gelir; flushSync orada React uyarısı üretir.
    useFlushSync: false,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtual && virtualItems.length > 0 ? virtualItems[0].start - scrollMargin : 0;
  const paddingBottom =
    virtual && virtualItems.length > 0 ? totalSize - (virtualItems[virtualItems.length - 1].end - scrollMargin) : 0;

  // Yalnız her kolon px'e dondurulmuşsa (ilk resize sonrası) tablo içeriğe sarılır
  // ve sondaki dolgu kolon artanı alır; aksi halde esnek kolon kalanı paylaşır.
  const sized = renderColumns.length > 0 && renderColumns.every(c => widths[c.key] != null);
  const minWidth = useMemo(
    () =>
      minTableWidth(renderColumns, widths, {
        leading: selectable ? CHECKBOX_PX : 0,
        minColumnWidth,
        rootFontSize,
      }),
    [renderColumns, widths, selectable, minColumnWidth, rootFontSize],
  );

  const leadColumns = renderColumns.length + (selectable ? 1 : 0) + (sized ? 1 : 0);
  const showSkeleton = loading && sortedRows.length === 0;

  if (!loading && sortedRows.length === 0 && emptyState) return <>{emptyState}</>;

  const renderRow = (entry: TableRow<T>, index: number): ReactNode => {
    const state = rowState?.(entry.row, index);
    const isSelected = selectable ? selected.has(entry.id) : Boolean(state?.selected);
    return (
      <tr
        key={entry.id}
        ref={virtual ? virtualizer.measureElement : undefined}
        data-index={index}
        data-selected={isSelected || undefined}
        onClick={onRowClick ? () => onRowClick(entry.row) : undefined}
        className={cn(
          'group transition-colors duration-150 hover:bg-muted/40',
          onRowClick && 'cursor-pointer',
          state?.pending && 'opacity-60',
          state?.disabled && 'opacity-50',
          state?.className,
        )}
      >
        {selectable ? (
          <td className={cn(CELL_BASE, 'pl-5 pr-0 print:hidden', cellClassName)} onClick={e => e.stopPropagation()}>
            <AnimatedCheckbox
              checked={isSelected}
              onToggle={() => toggleRow(entry.id)}
              label={selectionLabel?.(entry.row) ?? `Satır ${index + 1} seç`}
              disabled={state?.disabled}
            />
          </td>
        ) : null}
        {renderColumns.map((column, i) => {
          const extra = typeof column.cellClassName === 'function' ? column.cellClassName(entry.row) : column.cellClassName;
          return (
            <td
              key={column.key}
              className={cn(
                CELL_BASE,
                cellPadding(renderColumns, i, selectable),
                column.numeric ? 'text-right tabular-nums' : alignText(effectiveAlign(column)),
                column.printHidden && 'print:hidden',
                cellClassName,
                extra,
              )}
            >
              {!column.cell && column.editable ? (
                <EditableCell
                  value={String((entry.row as Record<string, unknown>)[column.key] ?? '')}
                  label={`${typeof column.header === 'string' ? column.header : column.key}, satır ${index + 1}`}
                  onChange={next => onCellEdit?.(entry.id, column.key, next)}
                />
              ) : (
                readCell(entry.row, column, { index, selected: isSelected })
              )}
            </td>
          );
        })}
        {sized ? <td aria-hidden className={cn(CELL_BASE, cellClassName)} /> : null}
      </tr>
    );
  };

  return (
    <div
      ref={rootRef}
      data-overflowing={overflowing || undefined}
      className={cn(
        'relative w-full text-sm',
        // Dinlenmede clip; tablo kökten genişse yatay kaydırıcı açılır.
        scrollMode === 'element' || overflowing ? 'overflow-x-auto' : 'overflow-x-clip',
        scrollMode === 'element' && 'overflow-y-auto',
        className,
      )}
      style={scrollMode === 'element' ? { height } : undefined}
    >
      <table
        className={cn('w-full border-separate border-spacing-0', sized && 'w-max')}
        style={{ tableLayout: 'fixed', minWidth: `max(100%, ${minWidth}px)` }}
      >
        <colgroup>
          {selectable ? <col style={{ width: CHECKBOX_WIDTH }} /> : null}
          {renderColumns.map(column => {
            const override = widths[column.key];
            const width = override ? `${override}px` : column.width;
            return <col key={column.key} style={width ? { width } : undefined} />;
          })}
          {sized ? <col /> : null}
        </colgroup>

        {!hideHeader ? (
          <TableHeader
            columns={renderColumns}
            thRefs={thRefs}
            filler={sized}
            selectable={selectable}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleAll={toggleAll}
            selectAllLabel={selectAllLabel}
            selectAllTitle={selectAllTitle}
            sort={sort}
            onToggleSort={toggleSort}
            resizable={resizable}
            onResizeStart={startResize}
            onResizeMove={moveResize}
            onResizeEnd={endResize}
            reorderable={reorderable}
            dragKey={dragKey}
            dropIndex={dropIndex}
            onReorderStart={startReorder}
            onReorderMove={moveReorder}
            onReorderEnd={endReorder}
            onColumnRename={onColumnRename}
            columnMenu={columnMenu}
            className={theadClassName}
            cellClassName={cellClassName}
          />
        ) : null}

        {/* İskelet → içerik: grup halinde 200ms solar, satır başı stagger yok. */}
        <tbody key={showSkeleton ? 'skeleton' : 'rows'} className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
          {showSkeleton ? (
            <SkeletonRows count={skeletonRows} columns={renderColumns} selectable={selectable} cellClassName={cellClassName} />
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={leadColumns} className="py-10 text-center text-sm text-muted-foreground">
                {emptyState ?? 'Kayıt yok'}
              </td>
            </tr>
          ) : (
            <>
              {paddingTop > 0 ? (
                <tr aria-hidden style={{ height: paddingTop }}>
                  <td colSpan={leadColumns} />
                </tr>
              ) : null}
              {virtual ? virtualItems.map(item => renderRow(sortedRows[item.index], item.index)) : sortedRows.map(renderRow)}
              {paddingBottom > 0 ? (
                <tr aria-hidden style={{ height: paddingBottom }}>
                  <td colSpan={leadColumns} />
                </tr>
              ) : null}
              {loading ? <SkeletonRows count={3} columns={renderColumns} selectable={selectable} cellClassName={cellClassName} /> : null}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
