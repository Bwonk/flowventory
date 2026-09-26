'use client';

import * as React from 'react';
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useReducedMotion,
  type Transition,
  type HTMLMotionProps,
} from 'motion/react';
import {
  useFloating,
  autoUpdate,
  offset as floatingOffset,
  flip,
  shift,
  arrow as floatingArrow,
  FloatingPortal,
  FloatingArrow,
  type UseFloatingReturn,
} from '@floating-ui/react';

import { getStrictContext } from '@/lib/get-strict-context';
import { EASE_OUT, INSTANT } from '@/lib/motion';
import { Slot, type WithAsChild } from '@/components/animate-ui/primitives/animate/slot';

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';

type TooltipData = {
  contentProps: HTMLMotionProps<'div'>;
  contentAsChild: boolean;
  rect: DOMRect;
  side: Side;
  sideOffset: number;
  align: Align;
  alignOffset: number;
  id: string;
};

type ShowTooltipOptions = {
  /** `openDelay`'i atla (ör. AlertTip — çağıran taraf açıyor, hover yok). */
  immediate?: boolean;
  /** Gecikmesiz ve animasyonsuz aç (klavye odağı). */
  instant?: boolean;
};

type GlobalTooltipContextType = {
  showTooltip: (data: TooltipData, options?: ShowTooltipOptions) => void;
  hideTooltip: () => void;
  hideImmediate: () => void;
  currentTooltip: TooltipData | null;
  /** Güncel balon animasyonsuz mu açılmalı (sıcak geçiş / klavye odağı). */
  currentInstant: boolean;
  transition: Transition;
  globalId: string;
  setReferenceEl: (el: HTMLElement | null) => void;
  referenceElRef: React.RefObject<HTMLElement | null>;
};

const [GlobalTooltipProvider, useGlobalTooltip] =
  getStrictContext<GlobalTooltipContextType>('GlobalTooltipProvider');

type TooltipContextType = {
  props: HTMLMotionProps<'div'>;
  setProps: React.Dispatch<React.SetStateAction<HTMLMotionProps<'div'>>>;
  asChild: boolean;
  setAsChild: React.Dispatch<React.SetStateAction<boolean>>;
  side: Side;
  sideOffset: number;
  align: Align;
  alignOffset: number;
  id: string;
};

const [LocalTooltipProvider, useTooltip] = getStrictContext<TooltipContextType>(
  'LocalTooltipProvider',
);

type TooltipPosition = { x: number; y: number };

function getResolvedSide(placement: Side | `${Side}-${Align}`) {
  if (placement.includes('-')) {
    return placement.split('-')[0] as Side;
  }
  return placement as Side;
}

/** Giriş/çıkışta balon tetikleyiciye doğru 4px kayık durur. */
function initialFromSide(side: Side): Partial<Record<'x' | 'y', number>> {
  if (side === 'top') return { y: 4 };
  if (side === 'bottom') return { y: -4 };
  if (side === 'left') return { x: 4 };
  return { x: -4 };
}

/** Ölçek tetikleyiciye bakan kenardan büyür (top → alt kenar, right → sol kenar…). */
const ORIGIN_FROM_SIDE: Record<Side, string> = {
  top: 'bottom center',
  bottom: 'top center',
  left: 'right center',
  right: 'left center',
};

/** Giriş 125ms, çıkış 100ms güçlü ease-out; ölçek 0.97'den (asla 0'dan değil). */
const ENTER_TRANSITION: Transition = { duration: 0.125, ease: EASE_OUT };
const EXIT_TRANSITION: Transition = { duration: 0.1, ease: EASE_OUT };

type TooltipProviderProps = {
  children: React.ReactNode;
  id?: string;
  openDelay?: number;
  closeDelay?: number;
  transition?: Transition;
};

function TooltipProvider({
  children,
  id,
  openDelay = 700,
  closeDelay = 300,
  transition = ENTER_TRANSITION,
}: TooltipProviderProps) {
  const globalId = React.useId();
  const [current, setCurrent] = React.useState<{
    data: TooltipData;
    instant: boolean;
  } | null>(null);
  // Callback'ler state kimliğine bağlanmasın diye güncel balon ref'te de tutulur.
  const openRef = React.useRef(false);
  const timeoutRef = React.useRef<number | null>(null);
  const lastCloseTimeRef = React.useRef<number>(0);
  const referenceElRef = React.useRef<HTMLElement | null>(null);

  const commit = React.useCallback((data: TooltipData, instant: boolean) => {
    openRef.current = true;
    setCurrent({ data, instant });
  }, []);

  const close = React.useCallback(() => {
    // Sıcak pencere yalnız gerçekten açık bir balon kapanınca başlar; açılmadan
    // geçilen tetikleyici sonrakini gecikmesiz açtırmasın.
    if (openRef.current) lastCloseTimeRef.current = Date.now();
    openRef.current = false;
    setCurrent(null);
  }, []);

  const showTooltip = React.useCallback(
    (data: TooltipData, options: ShowTooltipOptions = {}) => {
      // Gizli balon (ör. genişlemiş sidebar'ın kapalı-hal tooltip'i) hiç
      // "güncel" olmaz: görünmez balondan anlık geçiş yapılmasın.
      if (data.contentProps?.hidden) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Balon açıkken ya da az önce kapandıysa sonraki gecikmesiz ve
      // animasyonsuz açılır — tetikleyiciler arasında kayma/morph yok.
      const warm =
        openRef.current || Date.now() - lastCloseTimeRef.current < closeDelay;
      if (warm || options.instant) {
        commit(data, true);
        return;
      }
      if (options.immediate) {
        commit(data, false);
        return;
      }
      timeoutRef.current = window.setTimeout(
        () => commit(data, false),
        openDelay,
      );
    },
    [openDelay, closeDelay, commit],
  );

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(close, closeDelay);
  }, [closeDelay, close]);

  const hideImmediate = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    close();
  }, [close]);

  const setReferenceEl = React.useCallback((el: HTMLElement | null) => {
    referenceElRef.current = el;
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideImmediate();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', hideImmediate, true);
    window.addEventListener('resize', hideImmediate, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', hideImmediate, true);
      window.removeEventListener('resize', hideImmediate, true);
    };
  }, [hideImmediate]);

  return (
    <GlobalTooltipProvider
      value={{
        showTooltip,
        hideTooltip,
        hideImmediate,
        currentTooltip: current?.data ?? null,
        currentInstant: current?.instant ?? false,
        transition,
        globalId: id ?? globalId,
        setReferenceEl,
        referenceElRef,
      }}
    >
      <LayoutGroup>{children}</LayoutGroup>
      <TooltipOverlay />
    </GlobalTooltipProvider>
  );
}

type RenderedTooltipContextType = {
  side: Side;
  align: Align;
  open: boolean;
};

const [RenderedTooltipProvider, useRenderedTooltip] =
  getStrictContext<RenderedTooltipContextType>('RenderedTooltipContext');

type FloatingContextType = {
  context: UseFloatingReturn['context'];
  arrowRef: React.RefObject<SVGSVGElement | null>;
};

const [FloatingProvider, useFloatingContext] =
  getStrictContext<FloatingContextType>('FloatingContext');

const MotionTooltipArrow = motion.create(FloatingArrow);

type TooltipArrowProps = Omit<
  React.ComponentProps<typeof MotionTooltipArrow>,
  'context'
> & {
  withTransition?: boolean;
};

function TooltipArrow({
  ref,
  withTransition = true,
  ...props
}: TooltipArrowProps) {
  const { side, align, open } = useRenderedTooltip();
  const { context, arrowRef } = useFloatingContext();
  const { transition } = useGlobalTooltip();
  React.useImperativeHandle(ref, () => arrowRef.current as SVGSVGElement);

  const deg = { top: 0, right: 90, bottom: 180, left: -90 }[side];

  return (
    <MotionTooltipArrow
      ref={arrowRef}
      context={context}
      data-state={open ? 'open' : 'closed'}
      data-side={side}
      data-align={align}
      data-slot="tooltip-arrow"
      style={{ rotate: deg }}
      // layoutId yok: ok balonla birlikte anında yer değiştirir, kaymaz.
      transition={withTransition ? transition : undefined}
      {...props}
    />
  );
}

type TooltipPortalProps = React.ComponentProps<typeof FloatingPortal>;

function TooltipPortal(props: TooltipPortalProps) {
  return <FloatingPortal {...props} />;
}

function TooltipOverlay() {
  const { currentTooltip, currentInstant, transition, referenceElRef } =
    useGlobalTooltip();
  const reduceMotion = useReducedMotion();

  const [rendered, setRendered] = React.useState<{
    data: TooltipData | null;
    open: boolean;
    instant: boolean;
  }>({ data: null, open: false, instant: false });

  const arrowRef = React.useRef<SVGSVGElement | null>(null);

  const side = rendered.data?.side ?? 'top';
  const align = rendered.data?.align ?? 'center';

  const { refs, x, y, strategy, context, update } = useFloating({
    placement: align === 'center' ? side : `${side}-${align}`,
    whileElementsMounted: autoUpdate,
    middleware: [
      floatingOffset({
        mainAxis: rendered.data?.sideOffset ?? 0,
        crossAxis: rendered.data?.alignOffset ?? 0,
      }),
      flip(),
      shift({ padding: 8 }),
      floatingArrow({ element: arrowRef }),
    ],
  });

  React.useEffect(() => {
    if (currentTooltip) {
      setRendered({ data: currentTooltip, open: true, instant: currentInstant });
    } else {
      setRendered((p) => (p.data ? { ...p, open: false, instant: false } : p));
    }
  }, [currentTooltip, currentInstant]);

  React.useLayoutEffect(() => {
    if (referenceElRef.current) {
      refs.setReference(referenceElRef.current);
      update();
    }
  }, [referenceElRef, refs, update, rendered.data]);

  const ready = x != null && y != null;
  const Component = rendered.data?.contentAsChild ? Slot : motion.div;
  const resolvedSide = getResolvedSide(context.placement);

  // reduced-motion: yalnız opaklık. Aksi halde 0.97 ölçek + 4px kayma.
  const hiddenState = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.97, ...initialFromSide(resolvedSide) };
  const shownState = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, x: 0, y: 0 };

  return (
    <AnimatePresence mode="wait">
      {rendered.data && ready && (
        <TooltipPortal>
          <div
            ref={refs.setFloating}
            // Hover-only balon: Radix Popover/Dialog bunu "dışarı tıklama" saymasın.
            className="pointer-events-none"
            data-slot="tooltip-overlay"
            data-side={resolvedSide}
            data-align={rendered.data.align}
            data-state={rendered.open ? 'open' : 'closed'}
            style={{
              position: strategy,
              top: 0,
              left: 0,
              zIndex: 50,
              transform: `translate3d(${x!}px, ${y!}px, 0)`,
            }}
          >
            <FloatingProvider value={{ context, arrowRef }}>
              <RenderedTooltipProvider
                value={{
                  side: resolvedSide,
                  align: rendered.data.align,
                  open: rendered.open,
                }}
              >
                <Component
                  data-slot="tooltip-content"
                  data-side={resolvedSide}
                  data-align={rendered.data.align}
                  data-state={rendered.open ? 'open' : 'closed'}
                  // layoutId yok: sıcak geçişte balon tetikleyiciler arasında
                  // kaymaz, yeni yerinde anında belirir.
                  initial={rendered.instant ? false : hiddenState}
                  animate={
                    rendered.open
                      ? {
                          ...shownState,
                          transition: rendered.instant ? INSTANT : transition,
                        }
                      : { ...hiddenState, transition: EXIT_TRANSITION }
                  }
                  exit={{ ...hiddenState, transition: EXIT_TRANSITION }}
                  onAnimationComplete={() => {
                    if (!rendered.open)
                      setRendered({ data: null, open: false, instant: false });
                  }}
                  {...rendered.data.contentProps}
                  style={{
                    position: 'relative',
                    transformOrigin: ORIGIN_FROM_SIDE[resolvedSide],
                    ...(rendered.data.contentProps?.style || {}),
                  }}
                />
              </RenderedTooltipProvider>
            </FloatingProvider>
          </div>
        </TooltipPortal>
      )}
    </AnimatePresence>
  );
}

type TooltipProps = {
  children: React.ReactNode;
  side?: Side;
  sideOffset?: number;
  align?: Align;
  alignOffset?: number;
};

function Tooltip({
  children,
  side = 'top',
  sideOffset = 0,
  align = 'center',
  alignOffset = 0,
}: TooltipProps) {
  const id = React.useId();
  const [props, setProps] = React.useState<HTMLMotionProps<'div'>>({});
  const [asChild, setAsChild] = React.useState(false);

  return (
    <LocalTooltipProvider
      value={{
        props,
        setProps,
        asChild,
        setAsChild,
        side,
        sideOffset,
        align,
        alignOffset,
        id,
      }}
    >
      {children}
    </LocalTooltipProvider>
  );
}

type TooltipContentProps = WithAsChild<HTMLMotionProps<'div'>>;

function shallowEqualWithoutChildren(
  a?: HTMLMotionProps<'div'>,
  b?: HTMLMotionProps<'div'>,
) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a).filter((k) => k !== 'children');
  const keysB = Object.keys(b).filter((k) => k !== 'children');
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    // @ts-expect-error index
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function TooltipContent({ asChild = false, ...props }: TooltipContentProps) {
  const { setProps, setAsChild } = useTooltip();
  const lastPropsRef = React.useRef<HTMLMotionProps<'div'> | undefined>(
    undefined,
  );

  React.useEffect(() => {
    if (!shallowEqualWithoutChildren(lastPropsRef.current, props)) {
      lastPropsRef.current = props;
      setProps(props);
    }
  }, [props, setProps]);

  React.useEffect(() => {
    setAsChild(asChild);
  }, [asChild, setAsChild]);

  return null;
}

type TooltipTriggerProps = WithAsChild<HTMLMotionProps<'div'>>;

type ChildHandlers = Pick<
  React.HTMLAttributes<HTMLElement>,
  'onMouseEnter' | 'onMouseLeave' | 'onFocus' | 'onBlur' | 'onPointerDown'
>;

/**
 * Odak klavyeden mi geldi — fareyle tıklamada balon odaktan açılmaz.
 * Tetikleyici sarmalayıcı olabilir (odak çocuktan kabarır), `target` bakılır.
 */
function isKeyboardFocus(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  try {
    return target.matches(':focus-visible');
  } catch {
    return true;
  }
}

function TooltipTrigger({
  ref,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  asChild = false,
  ...props
}: TooltipTriggerProps) {
  const {
    props: contentProps,
    asChild: contentAsChild,
    side,
    sideOffset,
    align,
    alignOffset,
    id,
  } = useTooltip();
  const {
    showTooltip,
    hideTooltip,
    hideImmediate,
    currentTooltip,
    setReferenceEl,
  } = useGlobalTooltip();

  // Gizli balonun (ör. genişlemiş sidebar) tetikleyicisi global duruma dokunmaz.
  const disabled = Boolean(contentProps.hidden);

  // asChild'da Slot, çocuğun aynı adlı dinleyicilerini bizimkilerle ezer;
  // çocuğunkileri (ör. useIconHover `hoverProps`) de biz çağırırız.
  const child: ChildHandlers | undefined =
    asChild && React.isValidElement<ChildHandlers>(props.children)
      ? props.children.props
      : undefined;
  const childMouseEnter = child?.onMouseEnter;
  const childMouseLeave = child?.onMouseLeave;
  const childFocus = child?.onFocus;
  const childBlur = child?.onBlur;
  const childPointerDown = child?.onPointerDown;

  const triggerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => triggerRef.current as HTMLDivElement);

  const suppressNextFocusRef = React.useRef(false);

  const handleOpen = React.useCallback(
    (instant = false) => {
      if (!triggerRef.current || disabled) return;
      setReferenceEl(triggerRef.current);
      const rect = triggerRef.current.getBoundingClientRect();
      showTooltip(
        {
          contentProps,
          contentAsChild,
          rect,
          side,
          sideOffset,
          align,
          alignOffset,
          id,
        },
        { instant },
      );
    },
    [
      disabled,
      showTooltip,
      setReferenceEl,
      contentProps,
      contentAsChild,
      side,
      sideOffset,
      align,
      alignOffset,
      id,
    ],
  );

  const isCurrent = currentTooltip?.id === id;

  const handleHide = React.useCallback(() => {
    if (!disabled || isCurrent) hideTooltip();
  }, [disabled, isCurrent, hideTooltip]);

  // Açıkken gizlenen balon (ör. sidebar genişledi) ekranda asılı kalmasın.
  React.useEffect(() => {
    if (disabled && isCurrent) hideImmediate();
  }, [disabled, isCurrent, hideImmediate]);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(e);
      childPointerDown?.(e);
      if (currentTooltip?.id === id) {
        suppressNextFocusRef.current = true;
        hideImmediate();
        Promise.resolve().then(() => {
          suppressNextFocusRef.current = false;
        });
      }
    },
    [onPointerDown, childPointerDown, currentTooltip?.id, id, hideImmediate],
  );

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseEnter?.(e);
      childMouseEnter?.(e);
      handleOpen();
    },
    [handleOpen, onMouseEnter, childMouseEnter],
  );

  const handleMouseLeave = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(e);
      childMouseLeave?.(e);
      handleHide();
    },
    [handleHide, onMouseLeave, childMouseLeave],
  );

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      onFocus?.(e);
      childFocus?.(e);
      if (suppressNextFocusRef.current) return;
      // Yalnız klavye odağı açar; anında ve animasyonsuz (Tab'da balon kaymaz).
      if (isKeyboardFocus(e.target)) handleOpen(true);
    },
    [handleOpen, onFocus, childFocus],
  );

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      onBlur?.(e);
      childBlur?.(e);
      handleHide();
    },
    [handleHide, onBlur, childBlur],
  );

  const Component = asChild ? Slot : motion.div;

  return (
    <Component
      ref={triggerRef}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-slot="tooltip-trigger"
      data-side={side}
      data-align={align}
      data-state={currentTooltip?.id === id ? 'open' : 'closed'}
      {...props}
    />
  );
}

export {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipArrow,
  useGlobalTooltip,
  useTooltip,
  type TooltipProviderProps,
  type TooltipProps,
  type TooltipContentProps,
  type TooltipTriggerProps,
  type TooltipArrowProps,
  type TooltipPosition,
  type GlobalTooltipContextType,
  type TooltipContextType,
};
