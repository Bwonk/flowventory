'use client';

import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Transition,
} from 'motion/react';

import { getStrictContext } from '@/lib/get-strict-context';
import { useControlledState } from '@/hooks/use-controlled-state';
import { EASE_DRAWER, EASE_OUT, SPRING } from '@/lib/motion';

type SheetContextType = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

const [SheetProvider, useSheet] =
  getStrictContext<SheetContextType>('SheetContext');

type SheetProps = React.ComponentProps<typeof SheetPrimitive.Root>;

function Sheet(props: SheetProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props.open,
    defaultValue: props.defaultOpen,
    onChange: props.onOpenChange,
  });

  return (
    <SheetProvider value={{ isOpen, setIsOpen }}>
      <SheetPrimitive.Root
        data-slot="sheet"
        {...props}
        onOpenChange={setIsOpen}
      />
    </SheetProvider>
  );
}

type SheetTriggerProps = React.ComponentProps<typeof SheetPrimitive.Trigger>;

function SheetTrigger(props: SheetTriggerProps) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

type SheetCloseProps = React.ComponentProps<typeof SheetPrimitive.Close>;

function SheetClose(props: SheetCloseProps) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

type SheetPortalProps = React.ComponentProps<typeof SheetPrimitive.Portal>;

function SheetPortal(props: SheetPortalProps) {
  const { isOpen } = useSheet();

  return (
    <AnimatePresence>
      {isOpen && (
        <SheetPrimitive.Portal forceMount data-slot="sheet-portal" {...props} />
      )}
    </AnimatePresence>
  );
}

type SheetOverlayProps = Omit<
  React.ComponentProps<typeof SheetPrimitive.Overlay>,
  'asChild' | 'forceMount'
> &
  HTMLMotionProps<'div'>;

// Perde yalnız opaklıkla gelir (blur yok — tam ekran filtre pahalı);
// reduced-motion'da da aynı, zaten hareket içermiyor.
function SheetOverlay({
  transition = { duration: 0.2, ease: EASE_OUT },
  ...props
}: SheetOverlayProps) {
  return (
    <SheetPrimitive.Overlay asChild forceMount>
      <motion.div
        key="sheet-overlay"
        data-slot="sheet-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        {...props}
      />
    </SheetPrimitive.Overlay>
  );
}

type Side = 'top' | 'bottom' | 'left' | 'right';

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> &
  HTMLMotionProps<'div'> & {
    side?: Side;
  };

/** Kenar dışı konum — tam `transform` dizesi: x/y kısaltması ana iş
 * parçacığında karelenir, tam dize donanım hızlandırmalı oynatılabilir. */
const OFFSCREEN_TRANSFORM: Record<Side, string> = {
  right: 'translateX(100%)',
  left: 'translateX(-100%)',
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
};

const ONSCREEN_TRANSFORM: Record<Side, string> = {
  right: 'translateX(0%)',
  left: 'translateX(0%)',
  top: 'translateY(0%)',
  bottom: 'translateY(0%)',
};

/** Çıkış girişten hızlı ve sessiz: 200ms çekmece eğrisi, taşma yok. */
const EXIT_TRANSITION: Transition = { duration: 0.2, ease: EASE_DRAWER };

/** reduced-motion: kayma yok, salt opaklık. */
const REDUCED_TRANSITION: Transition = { duration: 0.15, ease: EASE_OUT };

function SheetContent({
  side = 'right',
  transition = SPRING,
  style,
  children,
  ...props
}: SheetContentProps) {
  const reduceMotion = useReducedMotion();

  const hidden = reduceMotion
    ? { opacity: 0 }
    : { transform: OFFSCREEN_TRANSFORM[side], opacity: 0 };
  const shown = reduceMotion
    ? { opacity: 1 }
    : { transform: ONSCREEN_TRANSFORM[side], opacity: 1 };

  const positionStyle: Record<Side, React.CSSProperties> = {
    right: { insetBlock: 0, right: 0 },
    left: { insetBlock: 0, left: 0 },
    top: { insetInline: 0, top: 0 },
    bottom: { insetInline: 0, bottom: 0 },
  };

  return (
    <SheetPrimitive.Content asChild forceMount {...props}>
      <motion.div
        key="sheet-content"
        data-slot="sheet-content"
        data-side={side}
        initial={hidden}
        animate={shown}
        exit={{
          ...hidden,
          transition: reduceMotion ? REDUCED_TRANSITION : EXIT_TRANSITION,
        }}
        style={{
          position: 'fixed',
          ...positionStyle[side],
          ...style,
        }}
        transition={reduceMotion ? REDUCED_TRANSITION : transition}
      >
        {children}
      </motion.div>
    </SheetPrimitive.Content>
  );
}

type SheetHeaderProps = React.ComponentProps<'div'>;

function SheetHeader(props: SheetHeaderProps) {
  return <div data-slot="sheet-header" {...props} />;
}

type SheetFooterProps = React.ComponentProps<'div'>;

function SheetFooter(props: SheetFooterProps) {
  return <div data-slot="sheet-footer" {...props} />;
}

type SheetTitleProps = React.ComponentProps<typeof SheetPrimitive.Title>;

function SheetTitle(props: SheetTitleProps) {
  return <SheetPrimitive.Title data-slot="sheet-title" {...props} />;
}

type SheetDescriptionProps = React.ComponentProps<
  typeof SheetPrimitive.Description
>;

function SheetDescription(props: SheetDescriptionProps) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" {...props} />
  );
}

export {
  useSheet,
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  type SheetProps,
  type SheetPortalProps,
  type SheetOverlayProps,
  type SheetTriggerProps,
  type SheetCloseProps,
  type SheetContentProps,
  type SheetHeaderProps,
  type SheetFooterProps,
  type SheetTitleProps,
  type SheetDescriptionProps,
};
