'use client';
// beui.dev/components/blocks/expandable-action-bar — Flowventory uyarlaması
// (DESIGN.md §5 "Araç yolu"): kompakt ikon aksiyonları, hover/focus'ta
// etiketleriyle açılır. Kaynaktan farklar: yol dili bg-muted ray + bg-card/
// hairline vurgu hapı (gölge/blur/yuvarlak hap yok), spring 350/35, ink ve
// card segment varyantları, ayraç, ikon hover'ı parent'tan (useIconHover),
// Radix trigger'larına `wrap` ile sarılma, basma geri bildirimi 0.99.

import { LayoutGroup, motion, type Transition, useReducedMotion } from 'motion/react';
import {
  Fragment,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useDismiss } from '@/lib/hooks/use-dismiss';
import { useHoverGesture } from '@/lib/hooks/use-hover-gesture';
import { useTapGesture } from '@/lib/hooks/use-tap-gesture';
import { TrackSlider, useTrackOverflow } from '@/components/shared/tool-track/track-overflow';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type ExpandableActionBarVariant = 'ghost' | 'card' | 'ink';

export type ExpandableActionBarItem = {
  id: string;
  /** Açık haldeki etiket; string ise tooltip'e de düşer. */
  label: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  /** Etiketin sağındaki sayaç; kapalı halde köşe rozetine döner. */
  badge?: ReactNode;
  /** Rozet rengi: ink (varsayılan, sayaç) · critical (acil sinyali). */
  badgeVariant?: 'ink' | 'critical';
  /** ghost (varsayılan) · card (bg-card + hairline) · ink (birincil). Yol başına en fazla bir ink. */
  variant?: ExpandableActionBarVariant;
  /** Öğeden önce ince dikey ayraç. */
  separatorBefore?: boolean;
  title?: string;
  'aria-label'?: string;
  /** useIconHover() `hoverProps` — animasyonlu ikon butondan sürülür (DESIGN.md §6). */
  hoverProps?: Pick<HTMLAttributes<HTMLButtonElement>, 'onMouseEnter' | 'onMouseLeave'>;
  /**
   * Butonu bir Radix tetikleyicisine sarar: `button => <Dialog trigger={button} />`.
   * Tetikleyici `asChild` ile butona binmeli; ilk dokunuş (etiketleri açan)
   * `preventDefault` ile tetikleyiciyi atlar.
   */
  wrap?: (button: ReactElement) => ReactNode;
};

export type ExpandableActionBarClassNames = {
  root?: string;
  track?: string;
  item?: string;
  activeItem?: string;
  icon?: string;
  label?: string;
  badge?: string;
};

export interface ExpandableActionBarProps {
  items: ExpandableActionBarItem[];
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  activeId?: string;
  onAction?: (item: ExpandableActionBarItem) => void;
  /**
   * İmleç yolun üstünde dinlenince açılır (varsayılan true). Dokunmatikte
   * karşılığı: ilk dokunuş yalnız açar, ikincisi aksiyonu çalıştırır.
   */
  expandOnHover?: boolean;
  expandOnFocus?: boolean;
  collapseDelay?: number;
  /** 'toolbar' aksiyon kümesi; 'tablist' sekmeler (öğeler role="tab", aktif aria-selected). */
  role?: 'toolbar' | 'tablist';
  /**
   * Mobilde (768px altı ya da dokunmatik/kaba işaretçi) yol hiç açılmaz:
   * ikon-only kalır, her dokunuş doğrudan çalışır. Varsayılan true.
   */
  staticOnMobile?: boolean;
  /**
   * Açılan yol akışta yer kaplamaz: kök kapalı genişliğini korur, yol sağa
   * demirli olarak komşu içeriğin ÜSTÜNE açılır. Başlık gibi `flex-wrap`
   * satırlarında açılma yüzünden satır kırılıp sayfanın zıplamasını
   * (ve imleç altından kaçan yolun açıl-kapan titremesini) önler.
   */
  overlay?: boolean;
  'aria-label'?: string;
  className?: string;
  classNames?: ExpandableActionBarClassNames;
}

/** Kanonik yay (DESIGN.md §6) — yol boyu, etiket açılışı ve vurgu hapı aynı hatta. */
const SPRING: Transition = { type: 'spring', stiffness: 350, damping: 35 };

const VARIANT_CLASS: Record<ExpandableActionBarVariant, string> = {
  ghost: 'text-muted-foreground hover:text-foreground focus-visible:text-foreground',
  card: 'border border-hairline bg-card text-foreground',
  ink: 'bg-primary text-primary-foreground hover:bg-primary/90',
};

/** Dokunmatik/kaba işaretçi (telefon, tablet) — hover yok. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setCoarse(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return coarse;
}

function useControllableExpanded({
  expanded,
  defaultExpanded,
  onExpandedChange,
}: {
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded ?? false);
  const isControlled = expanded !== undefined;
  const value = expanded ?? internalExpanded;

  const setValue = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  return [value, setValue] as const;
}

export function ExpandableActionBar({
  items,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  activeId,
  onAction,
  expandOnHover = true,
  expandOnFocus = true,
  collapseDelay = 90,
  role = 'toolbar',
  staticOnMobile = true,
  overlay = false,
  'aria-label': ariaLabel,
  className,
  classNames,
}: ExpandableActionBarProps) {
  const reduce = useReducedMotion();
  const layoutId = useId();
  const isMobile = useIsMobile();
  const coarsePointer = useCoarsePointer();
  // Mobil: etiketleri gösterecek hover yok, yer de dar — yol ikon-only kalır.
  const canExpand = !(staticOnMobile && (isMobile || coarsePointer));
  const hoverExpands = expandOnHover && canExpand;
  const focusExpands = expandOnFocus && canExpand;
  const [isExpanded, setIsExpanded] = useControllableExpanded({
    expanded,
    defaultExpanded,
    onExpandedChange,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Yolu açan dokunuş — dışarı-dokunuş kapatıcısının varlık sebebi;
  // hover eden imlecin kendi çıkış yolu var.
  const [tapExpanded, setTapExpanded] = useState(false);
  const collapseTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Overlay yönü: yol hangi tarafta daha çok boşluk varsa o yöne açılır ve
  // genişliği o boşlukla sınırlanır — dar ekranda sola yaslı bir yol sağa
  // demirlenip ekran dışına taşmaz.
  const [anchor, setAnchor] = useState<{ side: 'left' | 'right'; maxWidth: number } | null>(null);
  const placeOverlay = useCallback(() => {
    const root = rootRef.current;
    if (!overlay || !root) return;
    const rect = root.getBoundingClientRect();
    const spaceLeft = rect.right - 12;
    const spaceRight = window.innerWidth - rect.left - 12;
    const side = spaceLeft >= spaceRight ? 'right' : 'left';
    setAnchor({ side, maxWidth: Math.max(rect.width, side === 'right' ? spaceLeft : spaceRight) });
  }, [overlay]);
  const tap = useTapGesture<boolean>();
  const hover = useHoverGesture();

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
  }, []);

  const open = useCallback(() => {
    clearCollapseTimer();
    placeOverlay();
    setIsExpanded(true);
  }, [clearCollapseTimer, placeOverlay, setIsExpanded]);

  const close = useCallback(() => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      setIsExpanded(false);
      setHoveredId(null);
      setTapExpanded(false);
    }, collapseDelay);
  }, [clearCollapseTimer, collapseDelay, setIsExpanded]);

  useEffect(() => clearCollapseTimer, [clearCollapseTimer]);

  // Açıkken mobil eşiğine düşülürse (döndürme, pencere daralması) kapanır.
  useEffect(() => {
    if (!canExpand && isExpanded) setIsExpanded(false);
  }, [canExpand, isExpanded, setIsExpanded]);

  // Dışarıdan kapanış etiketleri götürür; açan dokunuşun bıraktığı "kurulu"
  // hal de gitmeli — yoksa sonraki dokunuş okunamayan bir aksiyonu çalıştırır.
  const wasExpanded = useRef(isExpanded);
  useEffect(() => {
    if (wasExpanded.current && !isExpanded) setTapExpanded(false);
    wasExpanded.current = isExpanded;
  }, [isExpanded]);

  // Parmak hover etmez, Safari dokunuşta odaklamaz: dokunuşla açılan yolu
  // dışarıya dokunuş kapatır — ve yutulur, altındaki kontrol yanlışlıkla çalışmaz.
  useDismiss(tapExpanded && isExpanded, close, trackRef, { behavior: 'consume' });

  const onRootPointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (hover.enter(event) && hoverExpands) open();
  };

  const onRootPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (!hover.leave(event)) return;
    setHoveredId(null);
    if (hoverExpands) close();
  };

  const onRootFocus = () => {
    if (focusExpands) open();
  };

  const onRootBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node) && focusExpands) close();
  };

  // Overlay: kapalı genişlik yol kapalıyken ölçülür ve kök o genişlikte kalır;
  // açık yol mutlak konumlu, sağa demirli.
  const [collapsedWidth, setCollapsedWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!overlay || !el) return;
    // Kapalı genişlik = yolun düzen genişliği − etiketlerin o anki genişliği
    // (+ sol boşlukları). Etiketler açık, kapalı ya da animasyonun ortasında
    // olsa da sonuç aynıdır; offsetWidth transform'dan etkilenmez.
    const record = () => {
      let width = el.offsetWidth;
      for (const label of Array.from(el.querySelectorAll<HTMLElement>('[data-label]'))) {
        width -= label.offsetWidth + (parseFloat(getComputedStyle(label).marginLeft) || 0);
      }
      const next = Math.round(width);
      setCollapsedWidth(prev => (prev === next ? prev : next));
    };
    const observer = new ResizeObserver(record);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    record();
    return () => observer.disconnect();
  }, [overlay, items.length]);

  const activeItemId = activeId ?? items.find(item => item.active)?.id;
  const highlightId = hoveredId ?? activeItemId;
  // Taşma: kaydırıcı, tekerlek, kenar solması, aktif öğenin görünüre kayması.
  const { overflow, maskStyle, sliderProps } = useTrackOverflow(trackRef, {
    activeValue: activeItemId ?? null,
    itemCount: items.length,
  });

  return (
    <LayoutGroup id={layoutId}>
      <motion.div
        ref={rootRef}
        layout={overlay ? false : 'size'}
        // Pointer olayları, mouse çifti değil: dokunuş pointerType taşımayan
        // uyumluluk mouseenter/leave'i üretir ve büyüyen yol parmağın altından
        // "leave" fırlatırdı — tek dokunuş açıp kapatıp hiçbir şey çalıştırmazdı.
        onPointerEnter={onRootPointerEnter}
        onPointerLeave={onRootPointerLeave}
        onFocus={onRootFocus}
        onBlur={onRootBlur}
        transition={SPRING}
        style={overlay && collapsedWidth !== null ? { width: collapsedWidth, height: 36 } : undefined}
        className={cn(
          'group/track relative inline-flex max-w-full',
          overlay && 'shrink-0',
          overlay && isExpanded && 'z-20',
          classNames?.root,
          className,
        )}
      >
        <motion.div
          ref={trackRef}
          layout="size"
          role={role}
          aria-label={ariaLabel}
          style={
            overlay && collapsedWidth !== null
              ? // width: max-content — mutlak konumlu yol kökün (kapalı) kutusuna göre
                // daralmasın; yalnız o taraftaki boşluk (maxWidth) sınırlar.
                { ...maskStyle, width: 'max-content', maxWidth: anchor?.maxWidth }
              : maskStyle
          }
          className={cn(
            // Etiketli aksiyonlar sığdığı alanı aşabilir — yol kendi içinde kayar,
            // son aksiyon kenardan taşıp erişilmez olmaz.
            'relative inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            // Overlay: mutlak konumlu, boşluğu olan tarafa demirli; kökün dışına
            // o yöne doğru büyür, sığmazsa kendi içinde kayar.
            overlay && collapsedWidth !== null && 'absolute top-0',
            overlay && collapsedWidth !== null && (anchor?.side === 'left' ? 'left-0' : 'right-0'),
            classNames?.track,
          )}
          transition={SPRING}
        >
          {items.map(item => {
            const isActive = item.active || activeId === item.id;
            const variant = item.variant ?? 'ghost';
            const isHighlighted = variant === 'ghost' && highlightId === item.id;
            const label = typeof item.label === 'string' ? item.label : undefined;

            const button = (
              <motion.button
                layout="position"
                type="button"
                data-value={item.id}
                role={role === 'tablist' ? 'tab' : undefined}
                aria-selected={role === 'tablist' ? isActive : undefined}
                disabled={item.disabled}
                title={item.title ?? label}
                aria-label={item['aria-label'] ?? label}
                onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
                  if (!hover.enter(event)) return;
                  clearCollapseTimer();
                  setHoveredId(item.id);
                }}
                onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
                  tap.start(event, isExpanded);
                }}
                // Platformun aldığı dokunuş click göndermez; tuş basımı ise
                // arkasında pointer olmayan bir aktivasyon başlatır — ikisi de
                // kaydı düşürmezse parmak bir sonraki click'e kalır.
                onPointerCancel={tap.drop}
                onKeyDown={tap.drop}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.currentTarget.blur();
                  const gesture = tap.take();
                  // Parmağa etiketleri gösteren bir şey yok: ilk dokunuş yolu
                  // açar, ikincisi aksiyonu çalıştırır. Durum jestin başından
                  // okunur — dokunuşta odaklayan tarayıcı yolu dokunuşun
                  // ortasında açar, aksi halde ilk dokunuş göstermesi gereken
                  // aksiyonu çalıştırırdı.
                  const firstTap =
                    gesture !== null && gesture.pointerType !== 'mouse' && !gesture.state && !tapExpanded;
                  if (firstTap && hoverExpands) {
                    // Radix tetikleyicisi (wrap) bu click'i görmesin.
                    event.preventDefault();
                    setTapExpanded(true);
                    open();
                    setHoveredId(item.id);
                    return;
                  }
                  item.onClick?.();
                  onAction?.(item);
                }}
                whileTap={reduce || item.disabled ? undefined : { scale: 0.99 }}
                transition={SPRING}
                {...item.hoverProps}
                className={cn(
                  'relative isolate inline-flex h-[30px] min-w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-md px-[9px] text-sm font-medium whitespace-nowrap outline-none transition-[color,background-color] duration-150',
                  'focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                  VARIANT_CLASS[variant],
                  isHighlighted && 'text-foreground',
                  classNames?.item,
                  isActive && classNames?.activeItem,
                )}
              >
                {/* Vurgu hapı — SegmentedTrack'in aktif hapıyla aynı dil; öğeler
                    arasında tek eleman olarak kayar. */}
                {isHighlighted ? (
                  <motion.span
                    layoutId="action-bar-highlight"
                    className="absolute inset-0 -z-10 rounded-md border border-hairline bg-card"
                    transition={SPRING}
                  />
                ) : null}

                <span
                  className={cn(
                    // Monogram gibi metin ikonlar 12px'ten geniş olabilir — yükseklik sabit, genişlik içerik.
                    'inline-flex h-3 min-w-3 shrink-0 items-center justify-center leading-none [&>svg]:size-3',
                    classNames?.icon,
                  )}
                >
                  {item.icon}
                </span>

                {/* Mobilde etiket hiç yok: ikon-only hal animasyon karesine bağlı kalmaz. */}
                {canExpand && (
                <motion.span
                  aria-hidden={!isExpanded}
                  animate={
                    reduce
                      ? {
                          width: isExpanded ? 'auto' : 0,
                          opacity: isExpanded ? 1 : 0,
                          marginLeft: isExpanded ? 6 : 0,
                          x: 0,
                          filter: 'blur(0px)',
                        }
                      : {
                          width: isExpanded ? 'auto' : 0,
                          opacity: isExpanded ? 1 : 0,
                          x: isExpanded ? 0 : -4,
                          marginLeft: isExpanded ? 6 : 0,
                          filter: isExpanded ? 'blur(0px)' : 'blur(3px)',
                        }
                  }
                  transition={reduce ? { duration: 0 } : SPRING}
                  data-label
                  className={cn('inline-block overflow-hidden whitespace-nowrap', classNames?.label)}
                >
                  {item.label}
                </motion.span>
                )}

                {item.badge ? (
                  <span
                    className={cn(
                      'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums',
                      item.badgeVariant === 'critical'
                        ? 'bg-critical text-critical-foreground'
                        : 'bg-primary text-primary-foreground',
                      isExpanded ? 'ml-1.5' : 'absolute top-0 right-0 h-3.5 min-w-3.5 text-[9px]',
                      classNames?.badge,
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </motion.button>
            );

            return (
              <Fragment key={item.id}>
                {item.separatorBefore && <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-hairline" />}
                {item.wrap ? item.wrap(button) : button}
              </Fragment>
            );
          })}
        </motion.div>
        <TrackSlider overflow={overflow} sliderProps={sliderProps} />
      </motion.div>
    </LayoutGroup>
  );
}
