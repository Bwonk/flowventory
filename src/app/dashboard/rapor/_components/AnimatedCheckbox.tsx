'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedCheckboxProps {
  /** 'mixed' = kısmi seçim (yalnız başlıktaki tümünü-seç kullanır). */
  checked: boolean | 'mixed';
  onToggle: () => void;
  /** Erişilebilir ad — satırın ürün adı ya da "Hepsini seç". */
  label: string;
  /** Hover ipucu — özellikle başlıktaki kısmi seçim durumunu açıklamak için. */
  title?: string;
  disabled?: boolean;
}

/**
 * Sepet tik kutucuğu — onboarding adım rozetiyle aynı hareket dili:
 * AnimatePresence + opacity/scale swap, spring 350/35 (DESIGN.md kanonik yay).
 */
export function AnimatedCheckbox({ checked, onToggle, label, title, disabled }: AnimatedCheckboxProps) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 350, damping: 35 } as const);
  // Çıkış hızlı ve düz: mixed→checked geçişinde eski "−" spring'le oyalanıp
  // yeni tikin üstünde görünmesin (kullanıcı "tik yerine −" olarak algılıyordu).
  const exitTransition = reduceMotion ? { duration: 0 } : { duration: 0.1 };
  const isMarked = checked !== false;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === 'mixed' ? 'mixed' : checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onToggle}
      // p-1 -m-1: görsel kutu 16px kalırken tıklama alanı genişler.
      className="group/check -m-1 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    >
      <span
        className={cn(
          'flex size-4 items-center justify-center rounded border transition-colors duration-150',
          isMarked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card group-hover/check:border-primary/40',
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {checked === true && (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: exitTransition }}
              transition={transition}
              className="flex"
            >
              <Check className="size-3" aria-hidden />
            </motion.span>
          )}
          {checked === 'mixed' && (
            <motion.span
              key="mixed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: exitTransition }}
              transition={transition}
              className="flex"
            >
              <Minus className="size-3" aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}
