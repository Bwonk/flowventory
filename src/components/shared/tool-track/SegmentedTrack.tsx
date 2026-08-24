'use client';

import { useId, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { TrackSlider, useTrackOverflow } from './track-overflow';

export interface SegmentedTrackOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Etiketin sağındaki rozet (ör. acil sayacı). */
  badge?: ReactNode;
  'aria-label'?: string;
}

interface SegmentedTrackProps<T extends string> {
  options: ReadonlyArray<SegmentedTrackOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** 'md' = 36px yol (sayfa araçlarıyla aynı), 'sm' = 32px (kart/grafik başlığı). */
  size?: 'sm' | 'md';
  /** 'tablist' içerik panellerini yönetir; 'group' basit bir anahtardır. */
  role?: 'tablist' | 'group';
  'aria-label'?: string;
  className?: string;
}

/**
 * Kayan haplı segment yolu (DESIGN.md §5 "Araç yolu"): `bg-muted` yol içinde
 * aktif segment `bg-card` + hairline hap olarak öne çıkar; hap tek elemandır
 * ve seçim değişince `layoutId` ile eski segmentten yenisine kayar (spring
 * 350/35). Taşma davranışı `useTrackOverflow`'dan (kaydırıcı, tekerlek,
 * kenar solması, aktifin görünüre kayması).
 */
export function SegmentedTrack<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  role = 'group',
  'aria-label': ariaLabel,
  className,
}: SegmentedTrackProps<T>) {
  const layoutId = useId();
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const { overflow, maskStyle, sliderProps } = useTrackOverflow(trackRef, {
    activeValue: value,
    itemCount: options.length,
  });
  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 350, damping: 35 };

  return (
    <div className={cn('group/track relative min-w-0', className)}>
      <div
        ref={trackRef}
        role={role}
        aria-label={ariaLabel}
        style={maskStyle}
        className={cn(
          'flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          size === 'md' ? 'h-9' : 'h-8',
        )}
      >
        {options.map(option => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              data-value={option.value}
              role={role === 'tablist' ? 'tab' : undefined}
              aria-selected={role === 'tablist' ? active : undefined}
              aria-pressed={role === 'group' ? active : undefined}
              aria-label={option['aria-label']}
              onClick={() => onChange(option.value)}
              className={cn(
                'relative flex h-full shrink-0 items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]',
                size === 'md' ? 'px-3 text-sm' : 'px-2.5 text-xs',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  aria-hidden
                  layoutId={layoutId}
                  transition={transition}
                  className="absolute inset-0 rounded-md border border-hairline bg-card"
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {option.label}
                {option.badge}
              </span>
            </button>
          );
        })}
      </div>
      <TrackSlider overflow={overflow} sliderProps={sliderProps} />
    </div>
  );
}
