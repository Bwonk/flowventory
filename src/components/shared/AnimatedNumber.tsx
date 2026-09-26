'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { springOrInstant } from '@/lib/motion';
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
  // Yön, önceki değer state'te tutularak render sırasında türetilir (React'in
  // "önceki render'dan bilgi saklama" kalıbı). Ref'i render'da yazmak
  // StrictMode'un çift render'ında yönü hep +1'e düşürüyordu.
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState<1 | -1>(1);
  if (value !== previous) {
    setPrevious(value);
    setDirection(value > previous ? 1 : -1);
  }
  const offset = reduceMotion ? 0 : 10;
  // Çıkan sayı `custom` ile GÜNCEL yönü okur — kendi girişindeki yönü değil.
  const variants: Variants = {
    enter: (dir: number) => ({ y: offset * dir, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (dir: number) => ({ y: -offset * dir, opacity: 0 }),
  };

  return (
    <span className={cn('relative inline-grid overflow-hidden align-baseline tabular-nums', className)}>
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={springOrInstant(reduceMotion)}
          className="[grid-area:1/1] inline-block"
        >
          {format(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
