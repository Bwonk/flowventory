'use client';

import { useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  /** Görüntü biçimi (para, binlik ayraç…); varsayılan düz sayı. */
  format?: (value: number) => ReactNode;
  className?: string;
}

/**
 * Değeri değişince sayıyı yön farkındalıklı kaydırarak değiştirir
 * (DESIGN.md §6): artışta yeni sayı alttan gelir, eskisi yukarı çıkar;
 * azalışta tersi. Tek hat hissi için giren/çıkan aynı spring 350/35'i
 * paylaşır, `popLayout` ile çıkan akıştan düşer. İlk boyamada ve
 * `prefers-reduced-motion`'da animasyon yok. Sayı `tabular-nums`.
 */
export function AnimatedNumber({ value, format = v => String(v), className }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  previous.current = value;
  const offset = reduceMotion ? 0 : 10 * direction;
  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 350, damping: 35 };

  return (
    <span className={cn('relative inline-grid overflow-hidden align-baseline tabular-nums', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: offset, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -offset, opacity: 0 }}
          transition={transition}
          className="[grid-area:1/1] inline-block"
        >
          {format(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
