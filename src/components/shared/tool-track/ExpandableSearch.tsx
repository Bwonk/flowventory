'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { Search, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  /** Açık haldeki giriş genişliği (px); mobilde 160'a iner. */
  width?: number;
  className?: string;
}

const SPRING: Transition = { type: 'spring', stiffness: 350, damping: 35 };

/**
 * Açılır arama segmenti (DESIGN.md §5 "Araç yolu"): `ToolTrack` içinde
 * yaşar. Dinlenmede yalnız büyüteç (30px kare); tıklanınca segment
 * `bg-card` + hairline hapa dönüşür ve giriş alanı spring 350/35 ile açılır.
 * Değer varken açık kalır (× temizler); boşken odak çıkınca ya da Escape ile
 * kapanır. Yoldaki filtre segmentleriyle aynı hap dili.
 */
export function ExpandableSearch({
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel = 'Ara',
  width = 220,
  className,
}: ExpandableSearchProps) {
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(value !== '');
  const expanded = open || value !== '';
  const openWidth = isMobile ? Math.min(width, 160) : width;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      clear();
    }
  };

  return (
    <div
      role="search"
      className={cn(
        'flex h-[30px] shrink-0 items-center rounded-md transition-colors duration-150',
        expanded && 'border border-hairline bg-card',
        className,
      )}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={expanded}
        onClick={() => (expanded ? inputRef.current?.focus() : setOpen(true))}
        className={cn(
          'flex h-full w-[30px] shrink-0 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          expanded ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Search className="size-3" aria-hidden />
      </button>
      <motion.div
        initial={false}
        animate={{ width: expanded ? openWidth : 0, opacity: expanded ? 1 : 0 }}
        transition={reduceMotion ? { duration: 0 } : SPRING}
        className="flex h-full items-center overflow-hidden"
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={event => onChange(event.target.value)}
          onBlur={() => {
            if (value === '') setOpen(false);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          tabIndex={expanded ? 0 : -1}
          style={{ width: openWidth - 28 }}
          className="h-full shrink-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="button"
          aria-label="Aramayı temizle"
          tabIndex={value !== '' ? 0 : -1}
          onClick={clear}
          className={cn(
            'flex h-full w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === '' && 'pointer-events-none opacity-0',
          )}
        >
          <X className="size-3" aria-hidden />
        </button>
      </motion.div>
    </div>
  );
}
