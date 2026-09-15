import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

/** Sıralamada `null`/`undefined`/`''` her iki yönde de en sona düşer ("—" hücreler). */
export type SortValue = string | number | null | undefined;

export type Align = 'left' | 'center' | 'right';

/** Aynı tuşa tıklayınca: `toggle` asc↔desc (ev varsayılanı), `cycle` asc→desc→yok (beui). */
export type SortCycle = 'toggle' | 'cycle';

/** `page`: sayfa kaydırıcısıyla (sidebar-inset) sanal liste; `element`: kök kendi içinde kayar (`height`). */
export type ScrollMode = 'page' | 'element';

export interface CellContext {
  index: number;
  selected: boolean;
}

export interface TableColumn<T> {
  /** Kararlı anahtar; `cell` yoksa `row[key]` okunur, `sortValue` yoksa sıralama değeri de odur. */
  key: string;
  header: ReactNode;
  /** `th` title'ı (kolon açıklaması). */
  headerTitle?: string;
  headerClassName?: string;
  align?: Align;
  /** Sayısal hücre: sağa dayalı `tabular-nums`; iskelet çubuğu da sağa yaslanır. */
  numeric?: boolean;
  /** CSS genişliği ("112px"). Verilmeyen kolon kalan alanı paylaşır (ürün kolonu). */
  width?: string;
  /** Esnek kolonun px tabanı — tablo bundan dar konteynerde yatay kayar. */
  minWidth?: number;
  sortable?: boolean;
  /** Kolona ilk tıklamada yön ("doğal yön"); varsayılan `asc`. */
  defaultDirection?: SortDirection;
  sortValue?: (row: T) => SortValue;
  cell?: (row: T, ctx: CellContext) => ReactNode;
  cellClassName?: string | ((row: T) => string | undefined);
  /** Yazdırmada kolon gizlenir (checkbox, satır aksiyonu). */
  printHidden?: boolean;
  /** `cell` yoksa hücre yerinde düzenlenen input olur (`onCellEdit`). */
  editable?: boolean;
}

export interface RowState {
  selected?: boolean;
  pending?: boolean;
  /** Seçim kutusu pasif + satır soluk. */
  disabled?: boolean;
  className?: string;
}

export interface TableMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface SelectionChange {
  added: string[];
  removed: string[];
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  /** Kararlı satır kimliği — seçim ve sanal ölçüm buna bağlı. */
  getRowId: (row: T, index: number) => string;
  /** Sanal liste için yükseklik tahmini (px); gerçek yükseklik ölçülür. Tek satır 41, thumb'lı 49. */
  rowHeight?: number;
  onRowClick?: (row: T) => void;
  rowState?: (row: T, index: number) => RowState | undefined;

  /** Başta tümünü-seç'li checkbox kolonu (`AnimatedCheckbox`); yazdırmada gizli. */
  selectable?: boolean;
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectionChange?: (ids: string[], change: SelectionChange) => void;
  /** Satır checkbox'ının erişilebilir adı. */
  selectionLabel?: (row: T) => string;
  selectAllLabel?: string;
  selectAllTitle?: (state: boolean | 'mixed') => string | undefined;

  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (next: SortState | null, prev: SortState | null) => void;
  sortCycle?: SortCycle;
  /** `false`: veri zaten sıralı gelir (stok/analiz hook'ları), yalnız başlık durumu çizilir. */
  clientSort?: boolean;
  /** `Intl.Collator` yereli; varsayılan `tr`. */
  locale?: string;

  /** Başlık sağ kenarından kolon genişletme. */
  resizable?: boolean;
  minColumnWidth?: number;
  onColumnResize?: (key: string, width: number) => void;
  /** Başlıktaki tutamaçla kolon sırası değiştirme. */
  reorderable?: boolean;
  onColumnOrderChange?: (keys: string[]) => void;

  /** `editable` hücre değişince. */
  onCellEdit?: (rowId: string, columnKey: string, value: string) => void;
  /** Verilirse sıralanamayan başlıklar kolon adı için input olur. */
  onColumnRename?: (columnKey: string, value: string) => void;
  /** Verilirse sona `RowActions` içinde "…" menüsü kolonu eklenir. */
  rowMenu?: (row: T, index: number) => TableMenuItem[];
  /** Verilirse başlık hover'ında "…" kolon menüsü belirir. */
  columnMenu?: (column: TableColumn<T>, index: number) => TableMenuItem[];

  scrollMode?: ScrollMode;
  /** `element` modunda kök yüksekliği (px). */
  height?: number;
  /** Bu satır sayısından itibaren sanal liste; altında tüm satırlar çizilir (varsayılan 80). */
  virtualizeThreshold?: number;
  overscan?: number;

  /** İlk yükleme: iskelet satırlar; veri varken sona ek iskelet. */
  loading?: boolean;
  skeletonRows?: number;
  /** Veri yokken tablo yerine tek başına çizilir (`EmptyState`). */
  emptyState?: ReactNode;
  hideHeader?: boolean;
  className?: string;
  theadClassName?: string;
  /** Her th/td'ye eklenir (rapor: `print:border-neutral-400`). */
  cellClassName?: string;
}

/** Satır + kararlı kimliği. */
export type TableRow<T> = { row: T; id: string };

/** Kolon anahtarı → başlık hücresi; resize/reorder hook'ları paylaşır. */
export type HeaderCellRefs = {
  current: Record<string, HTMLTableCellElement | null>;
};
