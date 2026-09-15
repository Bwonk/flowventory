'use client';

import { ChevronUp, GripVertical } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatedCheckbox } from '@/components/shared/AnimatedCheckbox';
import { TOUCH_GESTURE_CLASS } from '@/lib/touch';
import { cn } from '@/lib/utils';
import { TableMenu } from './table-menu';
import type { HeaderCellRefs, SortState, TableColumn, TableMenuItem } from './types';
import { alignFlex, alignText, cellPadding, effectiveAlign, MENU_COLUMN_KEY } from './utils';

export interface TableHeaderProps<T> {
  columns: TableColumn<T>[];
  thRefs: HeaderCellRefs;
  /** Tüm kolonlar px'e dondurulmuşsa sondaki dolgu hücresi çizilir. */
  filler: boolean;
  selectable: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  selectAllLabel: string;
  selectAllTitle?: (state: boolean | 'mixed') => string | undefined;
  sort: SortState | null;
  onToggleSort: (key: string) => void;
  resizable: boolean;
  onResizeStart: (key: string, e: ReactPointerEvent) => void;
  onResizeMove: (e: ReactPointerEvent) => void;
  onResizeEnd: (e: ReactPointerEvent) => void;
  reorderable: boolean;
  dragKey: string | null;
  dropIndex: number | null;
  onReorderStart: (key: string, e: ReactPointerEvent) => void;
  onReorderMove: (e: ReactPointerEvent) => void;
  onReorderEnd: (e: ReactPointerEvent) => void;
  onColumnRename?: (columnKey: string, value: string) => void;
  columnMenu?: (column: TableColumn<T>, index: number) => TableMenuItem[];
  className?: string;
  cellClassName?: string;
}

/** Mono mikro-etiket başlık hücresi; akışta durur, kaydırırken yapışmaz. `relative`: resize tutamacı ve bırakma göstergesi buna göre konumlanır. */
const TH_BASE =
  'group/th relative border-b border-border bg-card py-2 align-middle font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground';

export function TableHeader<T>({
  columns,
  thRefs,
  filler,
  selectable,
  allSelected,
  someSelected,
  onToggleAll,
  selectAllLabel,
  selectAllTitle,
  sort,
  onToggleSort,
  resizable,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  reorderable,
  dragKey,
  dropIndex,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
  onColumnRename,
  columnMenu,
  className,
  cellClassName,
}: TableHeaderProps<T>) {
  const headerState: boolean | 'mixed' = allSelected ? true : someSelected ? 'mixed' : false;

  return (
    <thead className={className}>
      <tr>
        {selectable ? (
          <th className={cn(TH_BASE, 'pl-5 pr-0 text-left print:hidden', cellClassName)}>
            <AnimatedCheckbox
              checked={headerState}
              onToggle={onToggleAll}
              label={selectAllLabel}
              title={selectAllTitle?.(headerState)}
            />
          </th>
        ) : null}
        {columns.map((column, index) => {
          const align = effectiveAlign(column);
          const active = sort?.key === column.key;
          const isDragging = dragKey === column.key;
          const internal = column.key === MENU_COLUMN_KEY;
          const canReorder = reorderable && !internal;
          const canResize = resizable && !internal;
          const menuItems = columnMenu && !internal ? columnMenu(column, index) : [];
          return (
            <th
              key={column.key}
              ref={el => {
                thRefs.current[column.key] = el;
              }}
              title={column.headerTitle}
              aria-sort={column.sortable ? (active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
              data-drop={dragKey ? dropIndex === index : undefined}
              data-dropend={dragKey ? dropIndex === columns.length && index === columns.length - 1 : undefined}
              className={cn(
                TH_BASE,
                cellPadding(columns, index, selectable),
                alignText(align),
                column.printHidden && 'print:hidden',
                // Bırakma göstergesi: ince ink çizgi, hedef kolonun sol (sonda sağ) kenarında.
                'data-[drop=true]:before:absolute data-[drop=true]:before:inset-y-0 data-[drop=true]:before:left-0 data-[drop=true]:before:w-0.5 data-[drop=true]:before:bg-foreground',
                'data-[dropend=true]:after:absolute data-[dropend=true]:after:inset-y-0 data-[dropend=true]:after:right-0 data-[dropend=true]:after:w-0.5 data-[dropend=true]:after:bg-foreground',
                cellClassName,
                column.headerClassName,
              )}
            >
              <div
                className={cn(
                  'flex min-w-0 items-center gap-1 transition-opacity duration-150',
                  alignFlex(align),
                  isDragging && 'opacity-50',
                )}
              >
                {canReorder ? (
                  <button
                    type="button"
                    aria-label={`${typeof column.header === 'string' ? column.header : column.key} kolonunu taşı`}
                    onPointerDown={e => onReorderStart(column.key, e)}
                    onPointerMove={onReorderMove}
                    onPointerUp={onReorderEnd}
                    // Akışta yer kaplamaz: hücrenin sol padding'ine biner, yalnız başlık hover'ında görünür.
                    className={cn(
                      'absolute inset-y-0 left-0 flex w-3 cursor-grab touch-none items-center justify-center text-muted-foreground/60 opacity-0 transition-opacity duration-150 group-hover/th:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing [@media(hover:none)]:opacity-100',
                      TOUCH_GESTURE_CLASS,
                    )}
                  >
                    <GripVertical className="size-3" aria-hidden />
                  </button>
                ) : null}
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onToggleSort(column.key)}
                    data-active={active}
                    data-direction={active ? sort?.direction : undefined}
                    className="group/sort relative inline-flex min-w-0 items-center rounded-sm whitespace-nowrap transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-foreground"
                  >
                    <span className="truncate">{column.header}</span>
                    {/* Ok hücre padding'inin içine mutlak konumlanır: kolon genişliği düz başlıkla aynı, hover'da hiçbir şey kaymaz. */}
                    <ChevronUp
                      aria-hidden
                      className={cn(
                        // Ok her hizada başlığın sağında (kullanıcı kararı, 25 Ağu 2026).
                        'absolute top-1/2 -right-3.5 size-3 -translate-y-1/2 opacity-0 transition-[opacity,transform] duration-150 motion-reduce:transition-none group-hover/sort:opacity-50 group-data-[active=true]/sort:opacity-100 group-data-[direction=desc]/sort:-translate-y-1/2 group-data-[direction=desc]/sort:rotate-180',
                      )}
                    />
                  </button>
                ) : onColumnRename && !internal ? (
                  <input
                    value={typeof column.header === 'string' ? column.header : ''}
                    aria-label={`${column.key} kolonunu yeniden adlandır`}
                    size={1}
                    onChange={e => onColumnRename(column.key, e.target.value)}
                    className={cn(
                      '-mx-1 min-w-0 flex-1 appearance-none rounded-sm border-0 bg-transparent px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground outline-none transition-colors duration-150 focus:bg-muted focus:text-foreground',
                      alignText(align),
                    )}
                  />
                ) : (
                  <span className="min-w-0 truncate whitespace-nowrap">{column.header}</span>
                )}
                {menuItems.length > 0 ? (
                  <TableMenu
                    ariaLabel={`${typeof column.header === 'string' ? column.header : column.key} kolon seçenekleri`}
                    items={menuItems}
                    triggerClassName="size-5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/th:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                  />
                ) : null}
              </div>
              {canResize ? (
                <button
                  type="button"
                  aria-label={`${typeof column.header === 'string' ? column.header : column.key} kolonunu genişlet`}
                  tabIndex={-1}
                  onPointerDown={e => onResizeStart(column.key, e)}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeEnd}
                  className={cn(
                    'absolute inset-y-0 right-0 w-1.5 cursor-col-resize touch-none bg-transparent transition-colors duration-150 hover:bg-border active:bg-foreground',
                    TOUCH_GESTURE_CLASS,
                  )}
                />
              ) : null}
            </th>
          );
        })}
        {filler ? <th aria-hidden className={cn(TH_BASE, cellClassName)} /> : null}
      </tr>
    </thead>
  );
}
