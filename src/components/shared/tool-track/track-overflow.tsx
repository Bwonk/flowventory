'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface TrackOverflow {
  on: boolean;
  /** Thumb konumu/genişliği, yüzde. */
  left: number;
  width: number;
  atStart: boolean;
  atEnd: boolean;
}

const NO_OVERFLOW: TrackOverflow = { on: false, left: 0, width: 100, atStart: true, atEnd: true };
const FADE = 28;

interface TrackOverflowOptions {
  /** `[data-value]` ile işaretli aktif öğe; değişince görünür alana kaydırılır. */
  activeValue?: string | null;
  /** Öğe sayısı — değişince gözlemciler yeniden bağlanır. */
  itemCount?: number;
}

/**
 * Yatay taşan araç yolu davranışı (DESIGN.md §5 "Araç yolu"): yol kayar
 * (scrollbar gizli), altında 2px kaydırıcı belirir (thumb sürüklenir, raya
 * tıklanınca atlar), fare yolun üstündeyken tekerlek yatay kaydırır, taşan
 * kenar 28px mask ile solar, aktif öğe görünür alana kaydırılır.
 * `SegmentedTrack` ve `ExpandableActionBar` paylaşır.
 */
export function useTrackOverflow(
  trackRef: RefObject<HTMLElement | null>,
  { activeValue, itemCount }: TrackOverflowOptions = {},
) {
  const reduceMotion = useReducedMotion();
  const [overflow, setOverflow] = useState<TrackOverflow>(NO_OVERFLOW);

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
    const next: TrackOverflow = {
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
  }, [trackRef]);

  // Ölçüm: scroll + boyut değişimi (yol ve çocukları). Tekerlek: dikey deltayı
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
  }, [measure, trackRef, itemCount]);

  // Aktif öğe görünür alana — yalnız yol kayar, sayfa değil.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || activeValue == null) return;
    const active = el.querySelector<HTMLElement>(`[data-value="${CSS.escape(activeValue)}"]`);
    if (!active || el.scrollWidth <= el.clientWidth) return;
    const pad = 12;
    const start = active.offsetLeft - pad;
    const end = active.offsetLeft + active.offsetWidth + pad;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    if (start < el.scrollLeft) el.scrollTo({ left: start, behavior });
    else if (end > el.scrollLeft + el.clientWidth) el.scrollTo({ left: end - el.clientWidth, behavior });
  }, [activeValue, reduceMotion, trackRef]);

  // Kaydırıcı: thumb sürükleme + raya tıklayıp atlama.
  const dragRef = useRef<{ x: number; scrollLeft: number; factor: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
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
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = trackRef.current;
    if (!drag || !el) return;
    el.scrollLeft = drag.scrollLeft + (event.clientX - drag.x) * drag.factor;
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const edge = (visible: boolean) => (visible ? '#000' : 'transparent');
  const gradient = `linear-gradient(90deg, ${edge(overflow.atStart)}, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${edge(overflow.atEnd)})`;
  const maskStyle: CSSProperties | undefined = overflow.on
    ? { maskImage: gradient, WebkitMaskImage: gradient }
    : undefined;

  return {
    overflow,
    maskStyle,
    sliderProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

interface TrackSliderProps {
  overflow: TrackOverflow;
  sliderProps: ReturnType<typeof useTrackOverflow>['sliderProps'];
  className?: string;
}

/** Yolun altındaki 2px kaydırıcı — yalnız taşınca görünür; ebeveyn `group/track relative`. */
export function TrackSlider({ overflow, sliderProps, className }: TrackSliderProps) {
  return (
    <div
      aria-hidden
      {...sliderProps}
      className={cn(
        'absolute inset-x-0 top-full mt-1 h-2 touch-none transition-opacity duration-150',
        overflow.on ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
    >
      <span className="absolute inset-x-0 top-[3px] h-0.5 rounded-full bg-hairline" />
      <span
        data-thumb
        style={{ left: `${overflow.left}%`, width: `${overflow.width}%` }}
        className="absolute top-[3px] h-0.5 cursor-grab rounded-full bg-muted-foreground transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] group-hover/track:bg-foreground active:cursor-grabbing"
      />
    </div>
  );
}
