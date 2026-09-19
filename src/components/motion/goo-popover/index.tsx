'use client';
// beui.dev/components/motion/popover — Flowventory uyarlaması (DESIGN.md §5 "Goo
// açılır panel", §6). Kaynaktan farklar: export'lar GooPopover* (ui/popover ile
// çakışmasın); yarıçap 8/6 (rounded-lg/rounded-md), boyun 8px, gooStrength 5, z-50;
// morph yayı kanonik 350/35. Oturunca (progress = 1) goo filtresi ve clip kapanır,
// panel standart açılır yüzey olur (border-hairline + bg-popover + shadow-md) —
// kaynakta kenarlık/gölge yoktu ve filtre dinlenirken köşeleri fazla yuvarlıyordu;
// akarken konturu gövdenin 1px dışında kalan ikinci bg-hairline goo katmanı çizer.
// Panel yalnız açıkken/kapanırken mount edilir (kaynak hep DOM'da tutuyordu);
// viewport çarpışması (resolveSide/resolveShiftX), açılışta odağın panele geçmesi,
// ↑/↓ gezinme, Tab döngüsü ve kapanışta odak iadesi eklendi. Geometri ve karar
// mantığı utils.ts'te (vitest). Hover modu kaynakla diff'lenebilir kalsın diye korundu.

import { animate, type MotionValue, type Transition, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import {
  cloneElement,
  createContext,
  isValidElement,
  type KeyboardEvent,
  type MouseEventHandler,
  type MutableRefObject,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { type DismissBehavior, useDismiss } from '@/lib/hooks/use-dismiss';
import { type HoverGesture, useHoverGesture } from '@/lib/hooks/use-hover-gesture';
import { useTapGesture } from '@/lib/hooks/use-tap-gesture';
import { cn } from '@/lib/utils';
import { usePopoverPortalPosition } from './position';
import {
  type Align,
  alignX,
  arrowNavigatesFrom,
  buildGeo,
  clipForProgress,
  contentOpacity,
  type Geo,
  nextFocusIndex,
  resolveShiftX,
  resolveSide,
  type Side,
  triggerCutout,
} from './utils';

type TriggerMode = 'click' | 'hover';

/** DESIGN.md §6 kanonik spring. */
const GOO_SPRING = { type: 'spring' as const, stiffness: 350, damping: 35 };
const HOVER_CLOSE_DELAY = 120;
/** Gövdenin hairline kontur katmanından içeri çekilmesi (px) — oturan panelin 1px kenarlığıyla aynı yer. */
const HAIRLINE = 1;
/** Katman kutusu payı: kontur ve goo kabarması kutu kenarında kesilmesin. */
const LAYER_PAD = 4;
const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

// Fare çifti yerine `onPointerEnter`/`onPointerLeave`: dokunuş, pointerType
// taşımayan uyumluluk mouseenter/mouseleave'i ateşler; paneli parmağın altında
// açıp kapatan buydu.
function makeHoverHandlers(hover: HoverGesture, enter: () => void, leave: () => void) {
  return {
    onPointerEnter: (event: PointerEvent) => {
      if (hover.enter(event)) enter();
    },
    onPointerLeave: (event: PointerEvent) => {
      if (hover.leave(event)) leave();
    },
  };
}

interface GooPopoverContextValue {
  open: boolean;
  mounted: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
  toggle: () => void;
  openHover: () => void;
  scheduleClose: () => void;
  triggerMode: TriggerMode;
  side: Side;
  align: Align;
  gap: number;
  panelRadius: number;
  triggerRadius: number;
  gooStrength: number;
  reduce: boolean;
  gooId: string;
  contentId: string;
  progress: MotionValue<number>;
  /** 1 = açılış morph'u bitti, panel gerçek yüzeyinde dinleniyor. */
  settled: MotionValue<number>;
  triggerRef: MutableRefObject<HTMLElement | null>;
  contentRef: MutableRefObject<HTMLDivElement | null>;
}

const GooPopoverContext = createContext<GooPopoverContextValue | null>(null);

/** Panel içeriğinden kapatma — menü öğeleri seçimden sonra çağırır. */
export function useGooPopoverClose(): () => void {
  return useGooPopoverContext('useGooPopoverClose').close;
}

function useGooPopoverContext(component: string) {
  const ctx = useContext(GooPopoverContext);
  if (!ctx) throw new Error(`${component} must be used within <GooPopover>`);
  return ctx;
}

export interface GooPopoverProps {
  children: ReactNode;
  /** Kontrollü açık durumu. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Panelin nasıl çağrıldığı. Varsayılan "click". */
  trigger?: TriggerMode;
  /** Panelin aktığı taraf; yer yoksa karşı tarafa çevrilir. Varsayılan "bottom". */
  side?: Side;
  align?: Align;
  /** Tetikleyici–panel aralığı (px) — goo boynunun uzunluğu. Varsayılan 8. */
  sideOffset?: number;
  /** Açık panelin köşe yarıçapı (px). Varsayılan 8 (`rounded-lg`). */
  panelRadius?: number;
  /** Tetikleyicinin köşe yarıçapı (px) — oyuk ve morph başlangıcı. Varsayılan 6 (`rounded-md`). */
  triggerRadius?: number;
  /** Goo filtresini besleyen bulanıklık — büyüdükçe daha çok erir. Varsayılan 5. */
  gooStrength?: number;
  /** Morph geçişi; verilmezse kanonik spring. Kimliği değişse de süren animasyonu yeniden başlatmaz. */
  transition?: { open?: Transition; close?: Transition };
  /** Dışarı tıklamanın altındaki kontrole geçip geçmeyeceği. Varsayılan "pass-through". */
  dismiss?: DismissBehavior;
  className?: string;
}

export function GooPopover({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  trigger = 'click',
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  panelRadius = 8,
  triggerRadius = 6,
  gooStrength = 5,
  dismiss = 'pass-through',
  transition,
  className,
}: GooPopoverProps) {
  const reduce = useReducedMotion() ?? false;
  const gooId = useId().replace(/:/g, '');
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpen = useRef(defaultOpen);
  const transitionRef = useRef(transition);
  useEffect(() => {
    transitionRef.current = transition;
  });
  const rootHover = useHoverGesture();
  const progress = useMotionValue(defaultOpen ? 1 : 0);
  const settled = useMotionValue(defaultOpen ? 1 : 0);

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;

  // Panel açılışta mount edilir, kapanış morph'u bitince sökülür.
  const [mounted, setMounted] = useState(defaultOpen);
  if (open && !mounted) setMounted(true);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openHover = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose, setOpen]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY);
  }, [cancelClose, setOpen]);

  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    let cancelled = false;
    settled.set(0);
    const custom = open ? transitionRef.current?.open : transitionRef.current?.close;
    const animation = animate(progress, open ? 1 : 0, reduce ? { duration: 0 } : (custom ?? GOO_SPRING));
    animation.then(() => {
      if (cancelled) return;
      if (open) settled.set(1);
      else setMounted(false);
    });
    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [open, progress, reduce, settled]);

  // Panel kapanınca inert olur ve sökülür; odak içinde kaldıysa (ya da inert
  // yüzünden body'ye düştüyse) tetikleyiciye döner — ARIA dialog kalıbı. Dışarıda
  // odaklanabilir bir şeye tıklandıysa odak zaten oradadır, dokunulmaz.
  useEffect(() => {
    if (wasOpen.current && !open) {
      const focused = document.activeElement;
      if (!focused || focused === document.body || contentRef.current?.contains(focused)) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
    wasOpen.current = open;
  }, [open]);

  // Panel portallı; dışarı tıklama tespitine iki ağaç da katılır.
  const ignoreContent = useCallback((target: Element) => Boolean(contentRef.current?.contains(target)), []);
  useDismiss(open, close, rootRef, { ignore: ignoreContent, behavior: dismiss });

  const ctx = useMemo<GooPopoverContextValue>(
    () => ({
      open,
      mounted,
      setOpen,
      close,
      toggle,
      openHover,
      scheduleClose,
      triggerMode: trigger,
      side,
      align,
      gap: sideOffset,
      panelRadius,
      triggerRadius,
      gooStrength,
      reduce,
      gooId,
      contentId,
      progress,
      settled,
      triggerRef,
      contentRef,
    }),
    [
      open,
      mounted,
      setOpen,
      close,
      toggle,
      openHover,
      scheduleClose,
      trigger,
      side,
      align,
      sideOffset,
      panelRadius,
      triggerRadius,
      gooStrength,
      reduce,
      gooId,
      contentId,
      progress,
      settled,
    ],
  );

  const hoverHandlers = trigger === 'hover' ? makeHoverHandlers(rootHover, openHover, scheduleClose) : {};

  return (
    <GooPopoverContext.Provider value={ctx}>
      <div ref={rootRef} className={cn('relative isolate inline-flex', className)} {...hoverHandlers}>
        {children}
      </div>
    </GooPopoverContext.Provider>
  );
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') (ref as MutableRefObject<T | null>).current = node;
    }
  };
}

export interface GooPopoverTriggerProps {
  /** Paneli açan tek, odaklanabilir öğe (ör. button). */
  children: ReactElement;
}

export function GooPopoverTrigger({ children }: GooPopoverTriggerProps) {
  const ctx = useGooPopoverContext('GooPopoverTrigger');
  // Tetikleyicideki son jest ve başladığında panelin açık olup olmadığı.
  const tap = useTapGesture<boolean>();

  if (!isValidElement(children)) return children;

  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props;
  const childRef = (childProps as { ref?: Ref<HTMLElement> }).ref;

  const compose =
    <E extends { defaultPrevented?: boolean }>(name: string, handler: (event: E) => void) =>
    (event: E) => {
      (childProps[name] as ((e: unknown) => void) | undefined)?.(event);
      if (!event.defaultPrevented) handler(event);
    };

  // Gözlem, eylem değil: pointerdown varsayılanını engelleyen bir çocuk jestin
  // olmadığını söylemiş olmaz; kayıt yine tutulur.
  const observe =
    <E,>(name: string, handler: (event: E) => void) =>
    (event: E) => {
      (childProps[name] as ((e: unknown) => void) | undefined)?.(event);
      handler(event);
    };

  // Hover tetikleyici hover yolunu korur ve üstüne dokunuş yolu *ekler*:
  // dokunmatik dizüstünde iki girdi de vardır. Dokunuşun hangi panel durumuna
  // göre davrandığı jestin başından okunur — tarayıcı temasta odaklayıp paneli
  // jest ortasında açarsa click onu geri kapatmasın.
  const handlers: Record<string, unknown> =
    ctx.triggerMode === 'hover'
      ? {
          onFocus: compose('onFocus', ctx.openHover),
          onBlur: compose('onBlur', ctx.scheduleClose),
          onPointerDown: observe<PointerEvent>('onPointerDown', event => tap.start(event, ctx.open)),
          onPointerCancel: observe('onPointerCancel', tap.drop),
          onKeyDown: observe('onKeyDown', tap.drop),
          onClick: compose('onClick', () => {
            const gesture = tap.take();
            if (!gesture || gesture.pointerType === 'mouse') return;
            ctx.setOpen(!gesture.state);
          }),
        }
      : { onClick: compose('onClick', ctx.toggle) };

  return cloneElement(child, {
    ...handlers,
    ref: mergeRefs(childRef, (node: HTMLElement | null) => {
      ctx.triggerRef.current = node;
    }),
    className: cn('relative z-0', childProps.className as string | undefined),
    'aria-haspopup': 'dialog',
    'aria-expanded': ctx.open,
    'aria-controls': ctx.open ? ctx.contentId : undefined,
    'data-state': ctx.open ? 'open' : 'closed',
  });
}

export interface GooPopoverContentProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  /**
   * Panel body'ye portallanır ama React olayları ağaçtan yukarı kabarır; panel
   * tıklanabilir bir atanın (tablo satırı) içindeyse burada durdurulur.
   */
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function GooPopoverContent({ children, className, 'aria-label': ariaLabel, onClick }: GooPopoverContentProps) {
  const ctx = useGooPopoverContext('GooPopoverContent');
  const {
    side,
    align,
    gap,
    panelRadius,
    triggerRadius,
    gooStrength,
    reduce,
    gooId,
    contentId,
    progress,
    settled,
    triggerRef,
    contentRef,
    open,
    mounted,
    close,
    triggerMode,
    openHover,
    scheduleClose,
  } = ctx;

  const panelHover = useHoverGesture();
  const portalRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const geoRef = useRef<Geo | null>(null);
  const supportsShapeRef = useRef(false);
  // Sunucu ve ilk istemci render'ı eşleşsin (defaultOpen); portal hydration'dan sonra bağlanır.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);
  const present = mounted && portalReady;
  const layout = usePopoverPortalPosition(triggerRef, contentRef, present);

  const geo = useMemo(() => {
    const triggerW = layout?.trigger.width ?? 0;
    const triggerH = layout?.trigger.height ?? 0;
    const contentW = layout?.content.width ?? 0;
    const contentH = layout?.content.height ?? 0;
    return buildGeo({
      triggerW,
      triggerH,
      contentW,
      contentH,
      side: layout
        ? resolveSide({
            preferred: side,
            triggerTop: layout.trigger.top,
            triggerHeight: triggerH,
            contentHeight: contentH,
            gap,
            viewportHeight: window.innerHeight,
          })
        : side,
      align,
      gap,
      panelRadius,
      triggerRadius,
      shiftX: layout
        ? resolveShiftX(layout.trigger.left, alignX(align, triggerW, contentW), contentW, window.innerWidth)
        : 0,
      pad: LAYER_PAD,
    });
  }, [layout, side, align, gap, panelRadius, triggerRadius]);

  // Aynı morph goo gövdesine, hairline kontura ve içeriğe uygulanır: panel tek
  // parça akar, metin onunla açılır (ölçeklenmez). Oturunca clip kalkar ki
  // yüzeyin kenarlığı ve gölgesi kesilmesin. Stil React'ten değil buradan
  // yazılır — yeniden render morph'un ortasında clip'i ezmesin.
  const paint = useCallback(() => {
    const g = geoRef.current;
    const isSettled = settled.get() === 1;
    portalRef.current?.toggleAttribute('data-settled', isSettled);
    if (!g || g.layerW === 0) return;
    const p = progress.get();
    const shape = supportsShapeRef.current;
    if (lineRef.current) lineRef.current.style.clipPath = clipForProgress(g, p, shape);
    if (blobRef.current) blobRef.current.style.clipPath = clipForProgress(g, p, shape, -HAIRLINE);
    if (clipRef.current) clipRef.current.style.clipPath = isSettled ? 'none' : clipForProgress(g, p, shape);
    if (contentRef.current) contentRef.current.style.opacity = isSettled ? '' : String(contentOpacity(p));
  }, [contentRef, progress, settled]);

  useLayoutEffect(() => {
    supportsShapeRef.current =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('clip-path', 'shape(from 0px 0px, line to 1px 1px, close)');
    geoRef.current = geo;
    paint();
  });

  useMotionValueEvent(progress, 'change', paint);
  useMotionValueEvent(settled, 'change', paint);

  // Açılışta odak panele geçer (portal body sonunda — Tab oraya ulaşmaz):
  // `autoFocus` alan kazandıysa dokunulmaz, yoksa seçili seçenek, o da yoksa ilk
  // odaklanabilir öğe.
  const measured = layout !== null;
  useEffect(() => {
    if (!open || !present || !measured) return;
    const panel = contentRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    const target =
      panel.querySelector<HTMLElement>('[data-selected="true"]') ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target.focus({ preventScroll: true });
    // Sayfa kaymasın, ama uzun listede seçili satır panelin içinde görünür olsun.
    if (target !== panel) target.scrollIntoView({ block: 'nearest' });
  }, [open, present, measured, contentRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const arrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    if (!arrow && event.key !== 'Tab') return;
    const from = event.target as HTMLElement;
    if (arrow && !arrowNavigatesFrom(from.tagName, (from as HTMLInputElement).type)) return;
    const panel = contentRef.current;
    if (!panel) return;
    // ↑/↓ seçenekler (button) arasında, Tab tüm odaklanabilirler arasında döner.
    const items = Array.from(panel.querySelectorAll<HTMLElement>(arrow ? 'button' : FOCUSABLE));
    const direction = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = nextFocusIndex(
      current,
      items.map(item => !(item as HTMLButtonElement).disabled),
      direction,
    );
    event.preventDefault();
    if (next >= 0) items[next].focus();
    else if (event.key === 'Tab') close();
  };

  const hoverHandlers = triggerMode === 'hover' ? makeHoverHandlers(panelHover, openHover, scheduleClose) : {};

  if (!present) return null;

  const layerStyle = { left: geo.left, top: geo.top, width: geo.layerW, height: geo.layerH };
  const gooLayerStyle = {
    ...layerStyle,
    filter: reduce ? undefined : `url(#${gooId})`,
    clipPath: triggerCutout(geo),
  };
  const pillStyle = {
    left: geo.origin.x,
    top: geo.origin.y,
    width: geo.origin.w,
    height: geo.origin.h,
    borderRadius: geo.origin.r,
  };
  // Goo katmanları oturunca söner (150ms), kapanışta anında geri gelir.
  const gooLayerClass =
    'pointer-events-none absolute group-data-[settled]/goo:opacity-0 group-data-[settled]/goo:transition-opacity group-data-[settled]/goo:duration-150';

  return createPortal(
    <div
      ref={portalRef}
      data-goo-popover-portal=""
      className="group/goo pointer-events-none fixed left-0 top-0 isolate z-50 size-0"
      style={{
        visibility: layout ? 'visible' : 'hidden',
        transform: `translate3d(${layout?.trigger.left ?? 0}px, ${layout?.trigger.top ?? 0}px, 0)`,
      }}
    >
      {/* Goo filtresi: bulanıklaştır, alfayı keskinleştirip katı şekle çevir, keskin
          aslını üstüne koy — damlalar sıvı kenarlarla birleşir. */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter id={gooId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={gooStrength} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Hairline kontur: gövdeyle aynı goo, altında ve 1px dışında (gövde içeri
          çekilir). Tetikleyici kopyaları eş boyda — oyuk ikisini de gizler, gerçek
          tetikleyiciye halka çizilmez. */}
      <div aria-hidden className={cn(gooLayerClass, 'z-[-2]')} style={gooLayerStyle}>
        <div className="absolute bg-hairline" style={pillStyle} />
        <div ref={lineRef} className="absolute inset-0 bg-hairline" />
      </div>

      {/* Goo gövdesi: sabit tetikleyici kopyası + morph eden damla. */}
      <div aria-hidden className={cn(gooLayerClass, 'z-[-1]')} style={gooLayerStyle}>
        <div className="absolute bg-popover" style={pillStyle} />
        <div ref={blobRef} className="absolute inset-0 bg-popover" />
      </div>

      {/* İçerik aynı morph'la kırpılır. Portal sarmalayıcı pointer'a şeffaftır;
          yalnız açık panel etkileşim alır. */}
      <div className="pointer-events-none absolute z-10" style={layerStyle}>
        <div ref={clipRef} inert={!open} className="absolute inset-0">
          <div
            ref={contentRef}
            id={contentId}
            role="dialog"
            aria-label={ariaLabel}
            tabIndex={-1}
            onClick={onClick}
            onKeyDown={onKeyDown}
            {...hoverHandlers}
            style={{
              position: 'absolute',
              left: geo.panel.x,
              top: geo.panel.y,
              borderRadius: panelRadius,
              // Oturunca clip kalkar; katman kutusu tetikleyiciyi de örttüğü için
              // pointer'ı kutu değil yalnız panel alır.
              pointerEvents: open ? 'auto' : 'none',
            }}
            className={cn(
              // Kenarlık hep yer tutar (ölçüm oynamasın); rengi, zemini ve gölgesi
              // oturunca gelir — akarken yüzey goo gövdesidir.
              'w-max max-w-[calc(100vw-1rem)] border border-transparent text-popover-foreground outline-none transition-[border-color,box-shadow] duration-150',
              'group-data-[settled]/goo:border-hairline group-data-[settled]/goo:bg-popover group-data-[settled]/goo:shadow-md',
              className,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
