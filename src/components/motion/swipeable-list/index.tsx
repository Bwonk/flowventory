'use client';
// beui.dev/components/blocks/swipeable-list — Flowventory uyarlaması (DESIGN.md §5
// "Kaydırmalı liste", §6 "Kaydırma motifi"). Kaynaktan farklar: yuvarlak hap/bg-muted
// sarmal, gölge, satır aralığı ve varsayılan başlık/açıklama düzeni yok (renderItem
// zorunlu); yüzey bg-card + hairline ayraç; aksiyon ikon+mikro etiket, tonlar yalnız
// neutral/danger; oturma yayı kanonik 350/35; karar mantığı utils.ts'te (vitest);
// sürüklemeyi izleyen click yutulur, açık yüzeye dokunuş kapatır; klavye ←/→/Esc ile
// ray açma-kapama ve odak iadesi; kaldırılan satır AnimatePresence ile çöker.

import {
  AnimatePresence,
  animate,
  motion,
  type PanInfo,
  type Transition,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { TOUCH_GESTURE_CONTENT_CLASS } from '@/lib/touch';
import { cn } from '@/lib/utils';
import type {
  SwipeAction,
  SwipeActionTone,
  SwipeSide,
  SwipeableListClassNames,
  SwipeableListItem,
  SwipeableListProps,
  SwipeableListValue,
} from './types';
import { clampReleaseVelocity, railWidth, resolveSwipeKey, resolveSwipeRelease, sideOffset } from './utils';

export type {
  SwipeAction,
  SwipeActionTone,
  SwipeSide,
  SwipeableListClassNames,
  SwipeableListItem,
  SwipeableListProps,
  SwipeableListValue,
} from './types';

/**
 * Bırakınca oturma yayı — kanonik 350/35 (DESIGN.md §6). restDelta/restSpeed
 * beui'den: 56px'lik kısa yolda yayın kuyruğunu erken keser, yüzey "titremez".
 */
const SPRING: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 35,
  restDelta: 0.5,
  restSpeed: 10,
};

/** Kaldırılan satırın çöküşü: opaklık önce söner, yükseklik ardından kapanır. */
const COLLAPSE: Transition = {
  opacity: { duration: 0.12 },
  height: { duration: 0.2, ease: 'easeOut', delay: 0.04 },
};
/** Sonradan eklenen satırın girişi: yalnız opaklık, yükseklik anlık (ilk boyamada hiç yok). */
const ENTER: Transition = { opacity: { duration: 0.15 }, height: { duration: 0 } };
const INSTANT: Transition = { duration: 0 };

const ACTION_TONE_CLASS: Record<SwipeActionTone, string> = {
  neutral: 'text-muted-foreground hover:text-foreground',
  danger: 'text-destructive',
};

/**
 * Yüzey içinde odak alabilen ilk öğe — ray kapanınca ya da satır kalkınca odak
 * buraya döner. tabindex=-1 dışlanır: kapalı rayın butonları DOM'da yüzeyden
 * önce gelir ve inert oldukları için odak sessizce başarısız olurdu.
 */
const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not(:disabled):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';
/** Komşu satırın yüzeyi: kaldırılan satırdan odak buraya devredilir. */
const SURFACE_SELECTOR = '[data-swipe-surface]';

/**
 * Kontrollü/kontrolsüz açık-satır değeri. `null` geçerli bir kontrollü değerdir
 * (hiçbir satır açık değil) — beui'nin `value ?? internal` kısayolu bunu kontrolsüz
 * sayıyordu; burada yalnız `undefined` kontrolsüz demektir.
 */
function useSwipeValue({
  value,
  defaultValue,
  onValueChange,
}: Pick<SwipeableListProps<unknown>, 'value' | 'defaultValue' | 'onValueChange'>) {
  const [internal, setInternal] = useState<SwipeableListValue | null>(defaultValue ?? null);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const setValue = useCallback(
    (next: SwipeableListValue | null) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return [current, setValue] as const;
}

function SwipeActionButton<T>({
  action,
  actionWidth,
  side,
  focusable,
  onAction,
  className,
}: {
  action: SwipeAction<T>;
  actionWidth: number;
  side: SwipeSide;
  focusable: boolean;
  onAction: (action: SwipeAction<T>, side: SwipeSide) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      tabIndex={focusable ? 0 : -1}
      aria-label={action.label}
      title={action.label}
      onClick={() => onAction(action, side)}
      className={cn(
        'flex h-full shrink-0 flex-col items-center justify-center gap-1 outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        ACTION_TONE_CLASS[action.tone ?? 'neutral'],
        className,
      )}
      style={{ width: actionWidth }}
    >
      <span className="[&>svg]:size-4" aria-hidden>
        {action.icon}
      </span>
      <span className="text-[10px] leading-none" aria-hidden>
        {action.label}
      </span>
    </button>
  );
}

function SwipeableListRow<T>({
  item,
  actionWidth,
  revealThreshold,
  openValue,
  setOpenValue,
  closeOnAction,
  onAction,
  onRemovedWithFocus,
  classNames,
  renderItem,
}: {
  item: SwipeableListItem<T>;
  actionWidth: number;
  revealThreshold: number;
  openValue: SwipeableListValue | null;
  setOpenValue: (value: SwipeableListValue | null) => void;
  closeOnAction: boolean;
  onAction?: SwipeableListProps<T>['onAction'];
  onRemovedWithFocus: (root: HTMLElement) => void;
  classNames?: SwipeableListClassNames;
  renderItem: SwipeableListProps<T>['renderItem'];
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const commandedTargetRef = useRef(0);
  // Sürüklemeyi izleyen click aynı görevde ve pointerup'tan sonra gelir; bayrak
  // o click yutulana kadar yaşar, sonra bir sonraki görevde temizlenir.
  const draggedRef = useRef(false);
  // Klavyeyle ray açılınca odak ilk aksiyona geçer; kapanınca buraya iade edilir.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pendingRailFocusRef = useRef(false);

  const leftActions = item.leftActions ?? [];
  const rightActions = item.rightActions ?? [];
  const leftWidth = railWidth(leftActions.length, actionWidth);
  const rightWidth = railWidth(rightActions.length, actionWidth);
  const openSide = openValue?.id === item.id ? openValue.side : null;
  const targetX = sideOffset(openSide, leftWidth, rightWidth);

  const settleX = useCallback(
    (nextX: number, velocity = 0) => {
      commandedTargetRef.current = nextX;
      animationRef.current?.stop();

      if (reduce) {
        x.set(nextX);
        return;
      }

      animationRef.current = animate(x, nextX, {
        ...SPRING,
        velocity: clampReleaseVelocity(velocity),
        onComplete: () => x.set(nextX),
      });
    },
    [reduce, x],
  );

  useEffect(() => () => animationRef.current?.stop(), []);

  // Dışarıdan gelen değer değişimi (başka satır açıldı, drawer Esc ile kapattı).
  useEffect(() => {
    if (commandedTargetRef.current === targetX) return;
    settleX(targetX);
  }, [settleX, targetX]);

  const snapTo = useCallback(
    (side: SwipeSide | null, velocity = 0) => {
      setOpenValue(side ? { id: item.id, side } : null);
      settleX(sideOffset(side, leftWidth, rightWidth), velocity);
    },
    [item.id, leftWidth, rightWidth, setOpenValue, settleX],
  );

  // Ray inert'ten çıkınca odak ilk aksiyona; kapanınca odak raydan (inert olunca
  // tarayıcı body'ye düşürür) satır içeriğine döner.
  useEffect(() => {
    if (openSide) {
      if (!pendingRailFocusRef.current) return;
      pendingRailFocusRef.current = false;
      railRef.current
        ?.querySelector<HTMLButtonElement>(`[data-side="${openSide}"] button:not(:disabled)`)
        ?.focus();
      return;
    }

    const active = document.activeElement;
    const lostToBody = !active || active === document.body;
    const inRail = railRef.current?.contains(active) ?? false;
    if (!lostToBody && !inRail) return;
    if (lostToBody && !returnFocusRef.current) return;

    const target =
      returnFocusRef.current ?? surfaceRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    returnFocusRef.current = null;
    target?.focus();
  }, [openSide]);

  // Satır DOM'dan kalkarken odak içindeyse listeye haber ver — DOM silinmeden
  // önce (layout cleanup) komşuya taşınsın, body'ye düşmesin.
  useLayoutEffect(() => {
    const root = rootRef.current;
    return () => {
      if (root && root.contains(document.activeElement)) onRemovedWithFocus(root);
    };
  }, [onRemovedWithFocus]);

  const onDragStart = useCallback(() => {
    draggedRef.current = true;
    animationRef.current?.stop();
    // Aynı anda tek satır açık: sürüklemeye başlamak diğerini kapatır.
    if (openValue && openValue.id !== item.id) setOpenValue(null);
  }, [item.id, openValue, setOpenValue]);

  const onDragEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      const velocity = info.velocity.x;
      const side = resolveSwipeRelease({
        latest: x.get(),
        velocity,
        openSide,
        leftWidth,
        rightWidth,
        revealThreshold,
      });
      snapTo(side, velocity);
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    },
    [leftWidth, openSide, revealThreshold, rightWidth, snapTo, x],
  );

  // Capture aşaması: Link'in bubble onClick'inden önce çalışır. Sürüklemeyi
  // izleyen click gezinmez; açık yüzeye dokunuş rayı kapatır, gezinmez.
  const onSurfaceClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!draggedRef.current && !openSide) return;
      event.preventDefault();
      event.stopPropagation();
      if (openSide && !draggedRef.current) snapTo(null);
    },
    [openSide, snapTo],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || item.disabled) return;
      const next = resolveSwipeKey(event.key, {
        openSide,
        hasLeft: leftActions.length > 0,
        hasRight: rightActions.length > 0,
      });
      if (next === undefined) return;
      event.preventDefault();
      // Esc'nin drawer'a ulaşmaması için değil (Radix capture'da dinler, drawer
      // kendisi ayırt eder) — aynı tuşun ata kaydırıcıya kaymaması için.
      event.stopPropagation();
      if (next) {
        returnFocusRef.current = surfaceRef.current?.contains(event.target as Node)
          ? (event.target as HTMLElement)
          : returnFocusRef.current;
        pendingRailFocusRef.current = true;
      }
      snapTo(next);
    },
    [item.disabled, leftActions.length, openSide, rightActions.length, snapTo],
  );

  const handleAction = useCallback(
    (action: SwipeAction<T>, side: SwipeSide) => {
      action.onClick?.(item);
      onAction?.({ item, action, side });
      if (closeOnAction) snapTo(null);
    },
    [closeOnAction, item, onAction, snapTo],
  );

  return (
    <div
      ref={rootRef}
      data-swipe-row
      onKeyDown={onKeyDown}
      className={cn(
        'relative isolate overflow-hidden border-b border-border',
        item.disabled && 'opacity-60',
        classNames?.item,
      )}
    >
      <div
        ref={railRef}
        role="group"
        aria-label="Satır eylemleri"
        aria-hidden={!openSide}
        inert={!openSide}
        className={cn('absolute inset-0 z-0 flex bg-muted', classNames?.rail)}
      >
        <div data-side="left" className="flex h-full">
          {leftActions.map(action => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              className={classNames?.action}
              focusable={openSide === 'left'}
              onAction={handleAction}
              side="left"
            />
          ))}
        </div>
        <div data-side="right" className="ml-auto flex h-full">
          {rightActions.map(action => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              className={classNames?.action}
              focusable={openSide === 'right'}
              onAction={handleAction}
              side="right"
            />
          ))}
        </div>
      </div>

      <motion.div
        ref={surfaceRef}
        data-swipe-surface
        drag={item.disabled ? false : 'x'}
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClickCapture={onSurfaceClickCapture}
        style={{ x }}
        className={cn(
          // touch-pan-y: yatay kaydırma satırın, dikey kaydırma listenin.
          // bg-card opak: altındaki ray yüzeyden sızmaz.
          'relative z-10 bg-card touch-pan-y',
          TOUCH_GESTURE_CONTENT_CLASS,
          classNames?.surface,
        )}
      >
        {renderItem(item, { openSide })}
      </motion.div>
    </div>
  );
}

export function SwipeableList<T>({
  items,
  value,
  defaultValue = null,
  onValueChange,
  onAction,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  collapseOnRemove = true,
  'aria-label': ariaLabel,
  className,
  classNames,
  renderItem,
}: SwipeableListProps<T>) {
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const [openValue, setOpenValue] = useSwipeValue({ value, defaultValue, onValueChange });

  // Kaldırılan satırın odağı komşu satıra (yoksa listeye) taşınır.
  const onRemovedWithFocus = useCallback((root: HTMLElement) => {
    const wrapper = root.closest('[role="listitem"]');
    const sibling = wrapper?.nextElementSibling ?? wrapper?.previousElementSibling;
    const target =
      sibling?.querySelector(SURFACE_SELECTOR)?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      listRef.current;
    target?.focus();
  }, []);

  const rows: ReactNode = items.map(item => (
    <motion.div
      key={item.id}
      role="listitem"
      initial={collapseOnRemove ? { opacity: 0, height: 'auto' } : false}
      animate={{ opacity: 1, height: 'auto' }}
      exit={
        collapseOnRemove
          ? { opacity: 0, height: 0, transition: reduce ? INSTANT : COLLAPSE }
          : undefined
      }
      transition={reduce ? INSTANT : ENTER}
      className="overflow-hidden"
    >
      <SwipeableListRow
        item={item}
        actionWidth={actionWidth}
        revealThreshold={revealThreshold}
        openValue={openValue}
        setOpenValue={setOpenValue}
        closeOnAction={closeOnAction}
        onAction={onAction}
        onRemovedWithFocus={onRemovedWithFocus}
        classNames={classNames}
        renderItem={renderItem}
      />
    </motion.div>
  ));

  return (
    <div
      ref={listRef}
      role="list"
      aria-label={ariaLabel}
      tabIndex={-1}
      // Hairline satır kökünde (çöküşle birlikte kırpılır); son satırınki kalkar.
      className={cn(
        'flex w-full flex-col outline-none [&>:last-child>[data-swipe-row]]:border-b-0',
        className,
        classNames?.root,
      )}
    >
      {collapseOnRemove ? <AnimatePresence initial={false}>{rows}</AnimatePresence> : rows}
    </div>
  );
}
