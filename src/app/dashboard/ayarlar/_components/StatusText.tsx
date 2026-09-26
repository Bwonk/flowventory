'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/lib/motion';
import { cn } from '@/lib/utils';

const TONE_CLASS = {
  success: 'text-status-healthy',
  error: 'text-destructive',
  muted: 'text-muted-foreground',
} as const;

/**
 * Buton yanındaki sonuç metni ("Kaydedildi", hata): 4px aşağıdan 150ms'de
 * oturur — birden belirmesin. Metin değişince yeniden oynasın diye çağıran
 * `key` verir. Reduced-motion: yalnız opaklık. `aria-live` sarmalayıcı çağıranda.
 */
export function StatusText({ tone, children }: { tone: keyof typeof TONE_CLASS; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
      className={cn('inline-block text-sm', TONE_CLASS[tone])}
    >
      {children}
    </motion.span>
  );
}
