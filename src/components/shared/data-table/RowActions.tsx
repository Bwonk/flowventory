import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Hover'da beliren satır aksiyonları (DESIGN.md §5 "Liste kalıbı"): hücrede
 * yeri hep ayrılıdır (layout kaymaz), satır hover/focus-within'de ve içindeki
 * bir popover açıkken görünür; dokunmatikte (hover:none) kalıcı görünür.
 * Satırın `group` sınıfına bağlıdır (Table satırları ve sepet satırı).
 */
export function RowActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
