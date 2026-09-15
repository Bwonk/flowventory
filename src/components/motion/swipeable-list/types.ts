import type { ReactNode } from 'react';

/** Rayın bulunduğu taraf: `left` sağa kaydırınca, `right` sola kaydırınca açılır. */
export type SwipeSide = 'left' | 'right';

/** Açık satır: aynı anda listede en fazla bir satır açık olabilir. */
export type SwipeableListValue = {
  id: string;
  side: SwipeSide;
};

/**
 * Aksiyon tonu — DESIGN.md §1 renk bütçesi: yalnız nötr ve yıkıcı. beui'nin
 * primary/success/warning tonları bilinçli olarak alınmadı.
 */
export type SwipeActionTone = 'neutral' | 'danger';

export type SwipeAction<T> = {
  id: string;
  /** Düz metin: ikon altındaki mikro etiket ve `aria-label` olarak kullanılır. */
  label: string;
  icon: ReactNode;
  tone?: SwipeActionTone;
  disabled?: boolean;
  onClick?: (item: SwipeableListItem<T>) => void;
};

export type SwipeableListItem<T> = {
  id: string;
  data: T;
  /** Sağa kaydırınca görünen aksiyonlar (sol ray). */
  leftActions?: SwipeAction<T>[];
  /** Sola kaydırınca görünen aksiyonlar (sağ ray). */
  rightActions?: SwipeAction<T>[];
  disabled?: boolean;
};

export type SwipeableListClassNames = {
  root?: string;
  item?: string;
  rail?: string;
  action?: string;
  surface?: string;
};

export interface SwipeableListProps<T> {
  items: SwipeableListItem<T>[];
  value?: SwipeableListValue | null;
  defaultValue?: SwipeableListValue | null;
  onValueChange?: (value: SwipeableListValue | null) => void;
  onAction?: (payload: {
    item: SwipeableListItem<T>;
    action: SwipeAction<T>;
    side: SwipeSide;
  }) => void;
  /** Her aksiyon sütununun genişliği (px). Varsayılan 56. */
  actionWidth?: number;
  /** Rayın açılması için en az sürükleme mesafesi (px). Varsayılan 34. */
  revealThreshold?: number;
  /** Aksiyona tıklayınca ray kapanır. Varsayılan true. */
  closeOnAction?: boolean;
  /** Listeden çıkan öğe yükseklik/opaklıkla çöker (AnimatePresence). Varsayılan true. */
  collapseOnRemove?: boolean;
  'aria-label'?: string;
  className?: string;
  classNames?: SwipeableListClassNames;
  /** Satır içeriği tüketicinindir; beui'nin başlık/açıklama düzeni yok. */
  renderItem: (item: SwipeableListItem<T>, ctx: { openSide: SwipeSide | null }) => ReactNode;
}
