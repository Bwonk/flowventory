import { type PointerEvent as ReactPointerEvent, useCallback, useMemo, useState } from 'react';
import { capturePointer, releasePointer } from '@/lib/touch';
import type { HeaderCellRefs, TableColumn } from './types';
import { applyColumnOrder, moveColumnKey } from './utils';

export function useColumnReorder<T>({
  columns,
  thRefs,
  onColumnOrderChange,
}: {
  columns: TableColumn<T>[];
  thRefs: HeaderCellRefs;
  onColumnOrderChange?: (keys: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>(() => columns.map(c => c.key));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const orderedColumns = useMemo(() => applyColumnOrder(order, columns), [order, columns]);

  const dropIndexFor = useCallback(
    (clientX: number) => {
      for (let i = 0; i < orderedColumns.length; i++) {
        const rect = thRefs.current[orderedColumns[i].key]?.getBoundingClientRect();
        if (rect && clientX < rect.left + rect.width / 2) return i;
      }
      return orderedColumns.length;
    },
    [orderedColumns, thRefs],
  );

  const startReorder = useCallback((key: string, e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragKey(key);
    capturePointer(e.currentTarget, e.pointerId);
  }, []);

  const moveReorder = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragKey) return;
      setDropIndex(dropIndexFor(e.clientX));
    },
    [dragKey, dropIndexFor],
  );

  const endReorder = useCallback(
    (e: ReactPointerEvent) => {
      releasePointer(e.currentTarget, e.pointerId);
      if (dragKey && dropIndex !== null) {
        const next = moveColumnKey(
          orderedColumns.map(c => c.key),
          dragKey,
          dropIndex,
        );
        setOrder(next);
        onColumnOrderChange?.(next);
      }
      setDragKey(null);
      setDropIndex(null);
    },
    [dragKey, dropIndex, orderedColumns, onColumnOrderChange],
  );

  return { orderedColumns, dragKey, dropIndex, startReorder, moveReorder, endReorder };
}
