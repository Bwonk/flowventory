'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/lib/motion';

/**
 * İskelet → içerik geçişi: sayfa içeriği grup halinde 200ms opaklıkla belirir
 * (DESIGN.md §6 "skeleton → içerik 200ms grup opacity", satır başı stagger
 * yok). Yalnız opaklık — transform yok ki sarmalanan sayfadaki `fixed`
 * öğeler (araç yolları, çekmeceler) animasyon sırasında kaymasın. Yalnız
 * mount'ta oynar; state değişimlerinde yeniden tetiklenmez.
 * `prefers-reduced-motion`'da anlık.
 */
export function ContentFadeIn({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
