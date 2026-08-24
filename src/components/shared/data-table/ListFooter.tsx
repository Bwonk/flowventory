'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ListFooterProps {
  /** Dinlenme notu — "N satır listelendi", kesme notu vb. */
  note: ReactNode;
  /** Seçili satır sayısı; 0 ise not görünür, >0 ise toplu çubuk. */
  selectedCount?: number;
  /** Toplu çubuğun sayaçtan sonraki içeriği (toplam, aksiyonlar). */
  selection?: ReactNode;
  onClearSelection?: () => void;
  className?: string;
}

/**
 * Liste alt bölgesi (DESIGN.md §5 "Liste kalıbı"): 48px tek bölge — dinlenmede
 * alt bilgi notu, seçim varken toplu aksiyon çubuğu. Aynı yeri paylaşırlar;
 * not 100ms söner, çubuk 8px yukarı kayarak 300ms belirir, 200ms çıkar.
 */
export function ListFooter({ note, selectedCount = 0, selection, onClearSelection, className }: ListFooterProps) {
  const reduceMotion = useReducedMotion();
  const showBulk = selectedCount > 0;

  return (
    <div className={cn('relative h-12 border-t border-border', className)}>
      <AnimatePresence initial={false} mode="wait">
        {showBulk ? (
          <motion.div
            key="bulk"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: reduceMotion ? 0 : 0.2 } }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center gap-3 pr-3 pl-5"
            aria-live="polite"
          >
            <p className="text-sm text-foreground">
              <span className="font-medium tabular-nums">{selectedCount}</span> satır seçildi
            </p>
            <div className="ml-auto flex items-center gap-2">
              {selection}
              {onClearSelection && (
                <>
                  <span aria-hidden className="mx-1 h-4 w-px bg-hairline" />
                  <Button variant="ghost" size="icon-sm" onClick={onClearSelection} aria-label="Seçimi temizle">
                    <X className="size-3" aria-hidden />
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="note"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.1 } }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className="absolute inset-0 flex items-center justify-center px-5 text-center text-xs text-muted-foreground"
          >
            {note}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
