'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

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

interface Overflow {
  on: boolean;
  /** Thumb konumu/genişliği, yüzde. */
  left: number;
  width: number;
  atStart: boolean;
  atEnd: boolean;
}

const NO_OVERFLOW: Overflow = { on: false, left: 0, width: 100, atStart: true, atEnd: true };
const FADE = 28;

/**
 * Kayan haplı segment yolu (DESIGN.md §5 "Araç yolu"): `bg-muted` yol içinde
 * aktif segment `bg-card` + hairline hap olarak öne çıkar; hap tek elemandır
 * ve seçim değişince `layoutId` ile eski segmentten yenisine kayar (spring
 * 350/35 — onboarding hap morph'uyla aynı yay).
 *
 * Taşma: segmentler sığmazsa yol yatay kayar (scrollbar gizli). Yolun altında
 * 2px kaydırıcı belirir (thumb sürüklenir, raya tıklanınca oraya atlar), fare
 * yolun üstündeyken tekerlek yatay kaydırır, taşan kenar 28px mask ile solar
 * ve seçilen segment görünür alana kaydırılır.
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
  const [overflow, setOverflow] = useState<Overflow>(NO_OVERFLOW);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 1) {
      setOverflow(prev => (prev.on ? NO_OVERFLOW : prev));
      return;
    }
    const width = Math.max(8, (el.clientWidth / el.scrollWidth) * 100);
    const ratio = el.scrollLeft / max;
    const next: Overflow = {
      on: true,
      left: Math.round(ratio * (100 - width) * 10) / 10,
      width: Math.round(width * 10) / 10,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft >= max - 1,
    };
    setOverflow(prev =>
      prev.on === next.on &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.atStart === next.atStart &&
      prev.atEnd === next.atEnd
        ? prev
        : next,
    );
  }, []);

  // Ölçüm: scroll + boyut değişimi (yol ve içeriği). Tekerlek: dikey deltayı
  // yatay kaydırmaya çevirir — passive:false şart, aksi halde sayfa da kayar.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      el.scrollLeft += delta;
      event.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure, options.length]);

  // Seçilen segment görünür alana — yalnız yol kayar, sayfa değil.
  useEffect(() => {
    const el = trackRef.current;
    const active = el?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
    if (!el || !active || el.scrollWidth <= el.clientWidth) return;
    const pad = 12;
    const start = active.offsetLeft - pad;
    const end = active.offsetLeft + active.offsetWidth + pad;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    if (start < el.scrollLeft) el.scrollTo({ left: start, behavior });
    else if (end > el.scrollLeft + el.clientWidth) el.scrollTo({ left: end - el.clientWidth, behavior });
  }, [value, reduceMotion]);

  // Kaydırıcı: thumb sürükleme + raya tıklayıp atlama.
  const dragRef = useRef<{ x: number; scrollLeft: number; factor: number } | null>(null);
  const sliderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const max = el.scrollWidth - el.clientWidth;
    const thumbWidth = (el.clientWidth / el.scrollWidth) * rect.width;
    const travel = Math.max(1, rect.width - thumbWidth);
    if ((event.target as HTMLElement).closest('[data-thumb]')) {
      dragRef.current = { x: event.clientX, scrollLeft: el.scrollLeft, factor: max / travel };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      el.scrollLeft = ((event.clientX - rect.left - thumbWidth / 2) / travel) * max;
    }
    event.preventDefault();
  };
  const sliderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = trackRef.current;
    if (!drag || !el) return;
    el.scrollLeft = drag.scrollLeft + (event.clientX - drag.x) * drag.factor;
  };
  const sliderPointerUp = () => {
    dragRef.current = null;
  };

  const maskStyle: CSSProperties | undefined = overflow.on
    ? {
        maskImage: `linear-gradient(90deg, ${overflow.atStart ? '#000' : 'transparent'}, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${overflow.atEnd ? '#000' : 'transparent'})`,
        WebkitMaskImage: `linear-gradient(90deg, ${overflow.atStart ? '#000' : 'transparent'}, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${overflow.atEnd ? '#000' : 'transparent'})`,
      }
    : undefined;

  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 350, damping: 35 };

  return (
    <div className={cn('group/track relative min-w-0', className)}>
      <div
        ref={trackRef}
        role={role}
        aria-label={ariaLabel}
        style={maskStyle}
        className={cn(
          'flex items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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

      {/* Taşma kaydırıcısı — 2px ray + thumb; yalnız taşınca görünür. */}
      <div
        aria-hidden
        onPointerDown={sliderPointerDown}
        onPointerMove={sliderPointerMove}
        onPointerUp={sliderPointerUp}
        onPointerCancel={sliderPointerUp}
        className={cn(
          'absolute inset-x-0 top-full mt-1 h-2 touch-none transition-opacity duration-150',
          overflow.on ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <span className="absolute inset-x-0 top-[3px] h-0.5 rounded-full bg-hairline" />
        <span
          data-thumb
          style={{ left: `${overflow.left}%`, width: `${overflow.width}%` }}
          className="absolute top-[3px] h-0.5 cursor-grab rounded-full bg-muted-foreground transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] group-hover/track:bg-foreground active:cursor-grabbing"
        />
      </div>
    </div>
  );
}
