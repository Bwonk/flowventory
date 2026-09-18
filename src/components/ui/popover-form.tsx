'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { ChevronUp, Loader } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckIcon, type CheckIconHandle } from '@/components/ui/icons/check';
import { cn } from '@/lib/utils';

/**
 * cult-ui "popover-form" (https://cult-ui.com/docs/components/popover-form) —
 * küçük bir tetikleyiciden panele shared-layout morph ile açılan form.
 *
 * Kaynak dosya upstream'den alındı, sonra DESIGN.md sözleşmesine çevrildi:
 * arbitrary hex ve `dark:` varyantları `bg-card`/token'lara, mavi gradient
 * buton ink'e (`bg-primary`), `#2090FF` başarı ikonu `CheckIcon` +
 * `text-status-healthy`'ye, spring'ler kanonik 350/35'e taşındı;
 * `prefers-reduced-motion` ve tetikleyici-dışı-tıklama muafiyeti eklendi.
 * Yerleşim kararları (genişlik, konum, kök sarmalayıcı) prop'lara açıldı —
 * upstream'deki 300px'lik demo sarmalayıcısı kaldırıldı.
 */

/** DESIGN.md §6 kanonik spring. */
const SPRING = { type: 'spring' as const, stiffness: 350, damping: 35 };

type PopoverFormProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openChild?: ReactNode;
  successChild?: ReactNode;
  showSuccess: boolean;
  width?: string;
  height?: string;
  showCloseButton?: boolean;
  title: string;
  /** Tetikleyicide düz `title` metni yerine render edilecek içerik (ikon + etiket). */
  triggerChildren?: ReactNode;
  /** Kök sarmalayıcı. Panel `absolute` olduğu için konumlandırma bağlamı buradan gelir. */
  className?: string;
  triggerClassName?: string;
  /** Panelin konumu — ör. yukarı açılmak için `absolute bottom-0 left-0`. */
  panelClassName?: string;
};

export function PopoverForm({
  open,
  setOpen,
  openChild,
  showSuccess,
  successChild,
  width = '364px',
  height = '192px',
  title = 'Feedback',
  showCloseButton = false,
  triggerChildren,
  className,
  triggerClassName,
  panelClassName,
}: PopoverFormProps) {
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  // Tetikleyici de muaf: açıkken ona tıklamak mousedown(kapat) → click(aç)
  // sırasıyla paneli yeniden açıyordu.
  useClickOutside([ref, triggerRef], () => setOpen(false));

  const layoutTransition = reduceMotion ? { duration: 0 } : SPRING;

  return (
    <div key={title} className={cn('relative', className)}>
      <motion.button
        ref={triggerRef}
        type="button"
        layoutId={`${title}-wrapper`}
        transition={layoutTransition}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ borderRadius: 8 }}
        className={cn(
          'flex h-9 items-center border border-hairline bg-card px-3 text-sm font-medium outline-none',
          triggerClassName,
        )}
      >
        <motion.span layoutId={`${title}-title`} transition={layoutTransition}>
          {triggerChildren ?? title}
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            layoutId={`${title}-wrapper`}
            transition={layoutTransition}
            role="dialog"
            aria-label={title}
            className={cn(
              'absolute overflow-hidden border border-hairline bg-muted p-1 shadow-md outline-none',
              panelClassName,
            )}
            ref={ref}
            style={{ borderRadius: 10, width, height }}
          >
            {/* Panelde düz `title` — `triggerChildren` içindeki ref'li ikon
                iki kez mount olsa tek ref'i iki eleman paylaşırdı. Morph
                sırasında zaten formun altında kalır. */}
            <motion.span
              aria-hidden
              className="absolute left-4 top-[17px] text-sm text-muted-foreground data-[success=true]:text-transparent"
              layoutId={`${title}-title`}
              transition={layoutTransition}
              data-success={showSuccess}
            >
              {title}
            </motion.span>

            {showCloseButton && (
              <div className="absolute -top-[5px] left-1/2 z-20 flex h-[26px] w-[12px] -translate-x-1/2 transform items-center justify-center">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute z-10 -mt-1 flex h-[6px] w-[10px] items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground focus:outline-none"
                  aria-label="Kapat"
                >
                  <ChevronUp className="text-muted-foreground/80" />
                </button>

                <PopoverFormCutOutTopIcon />
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {showSuccess ? (
                <motion.div
                  key="success"
                  initial={reduceMotion ? { opacity: 0 } : { y: -32, opacity: 0, filter: 'blur(4px)' }}
                  animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1, filter: 'blur(0px)' }}
                  transition={layoutTransition}
                  className="flex h-full flex-col items-center justify-center"
                >
                  {successChild || <PopoverFormSuccess />}
                </motion.div>
              ) : (
                <motion.div
                  key="open-child"
                  exit={reduceMotion ? { opacity: 0 } : { y: 8, opacity: 0, filter: 'blur(4px)' }}
                  transition={layoutTransition}
                  style={{ borderRadius: 10 }}
                  className="z-20 h-full border border-hairline bg-card"
                >
                  {openChild}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PopoverFormButton({ loading, text = 'submit' }: { loading: boolean; text: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="submit"
      disabled={loading}
      className="ml-auto flex h-7 items-center justify-center overflow-hidden rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${loading}`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -25 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 25 }}
          transition={reduceMotion ? { duration: 0 } : SPRING}
          className="flex w-full items-center justify-center"
        >
          {loading ? <Loader className="size-3 animate-spin" /> : <span>{text}</span>}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/**
 * Panel dışına tıklamayı yakalar. Birden çok ref alır: tetikleyici gibi
 * "dışarısı sayılmaması gereken" elemanlar muaf tutulabilsin diye.
 */
const useClickOutside = (
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  handleOnClickOutside: (event: MouseEvent | TouchEvent) => void,
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (refs.some(r => r.current?.contains(target))) return;
      handleOnClickOutside(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
    // refs dizisi her render'da yeni referans; içindeki ref nesneleri sabit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleOnClickOutside]);
};

export function PopoverFormSuccess({
  title = 'Tamam',
  description = 'Gönderildi.',
}: {
  title?: string;
  description?: string;
}) {
  const checkRef = useRef<CheckIconHandle>(null);
  const reduceMotion = useReducedMotion();

  // Tik bir kez çizilir; kalıcı sinyali metin taşır.
  useEffect(() => {
    if (!reduceMotion) checkRef.current?.startAnimation();
  }, [reduceMotion]);

  return (
    <>
      <CheckIcon ref={checkRef} size={28} className="flex text-status-healthy" aria-hidden />
      <h3 className="mb-1 mt-2 text-sm font-medium text-foreground">{title}</h3>
      <p className="mx-auto max-w-xs text-pretty text-center text-sm text-muted-foreground">{description}</p>
    </>
  );
}

export function PopoverFormSeparator({ width = 352, height = 2 }: { width?: number | string; height?: number }) {
  return (
    <svg
      className="absolute left-0 right-0 top-[-1px]"
      width={width}
      height={height}
      viewBox="0 0 352 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path d="M0 1H352" className="stroke-border" strokeDasharray="4 4" />
    </svg>
  );
}

function PopoverFormCutOutTopIcon({ width = 44, height = 30 }: { width?: number; height?: number }) {
  const aspectRatio = 6 / 12;
  const calculatedHeight = width * aspectRatio;
  const calculatedWidth = height / aspectRatio;

  const finalWidth = Math.min(width, calculatedWidth);
  const finalHeight = Math.min(height, calculatedHeight);

  return (
    <svg
      width={finalWidth}
      height={finalHeight}
      viewBox="0 0 6 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mt-[1px] rotate-90"
      preserveAspectRatio="none"
    >
      <g clipPath="url(#popover-form-cutout-top)">
        <path
          d="M0 2C0.656613 2 1.30679 2.10346 1.91341 2.30448C2.52005 2.5055 3.07124 2.80014 3.53554 3.17157C3.99982 3.54301 4.36812 3.98396 4.6194 4.46927C4.87067 4.95457 5 5.47471 5 6C5 6.52529 4.87067 7.04543 4.6194 7.53073C4.36812 8.01604 3.99982 8.45699 3.53554 8.82843C3.07124 9.19986 2.52005 9.4945 1.91341 9.69552C1.30679 9.89654 0.656613 10 0 10V6V2Z"
          className="fill-muted"
        />
        <path
          d="M1 12V10C2.06087 10 3.07828 9.57857 3.82843 8.82843C4.57857 8.07828 5 7.06087 5 6C5 4.93913 4.57857 3.92172 3.82843 3.17157C3.07828 2.42143 2.06087 2 1 2V0"
          className="stroke-border"
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="popover-form-cutout-top">
          <rect width={finalWidth} height={finalHeight} fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function PopoverFormCutOutLeftIcon() {
  return (
    <svg width="6" height="12" viewBox="0 0 6 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#popover-form-cutout-side)">
        <path
          d="M0 2C0.656613 2 1.30679 2.10346 1.91341 2.30448C2.52005 2.5055 3.07124 2.80014 3.53554 3.17157C3.99982 3.54301 4.36812 3.98396 4.6194 4.46927C4.87067 4.95457 5 5.47471 5 6C5 6.52529 4.87067 7.04543 4.6194 7.53073C4.36812 8.01604 3.99982 8.45699 3.53554 8.82843C3.07124 9.19986 2.52005 9.4945 1.91341 9.69552C1.30679 9.89654 0.656613 10 0 10V6V2Z"
          className="fill-muted"
        />
        <path
          d="M1 12V10C2.06087 10 3.07828 9.57857 3.82843 8.82843C4.57857 8.07828 5 7.06087 5 6C5 4.93913 4.57857 3.92172 3.82843 3.17157C3.07828 2.42143 2.06087 2 1 2V0"
          className="stroke-border"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="popover-form-cutout-side">
          <rect width="6" height="12" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function PopoverFormCutOutRightIcon() {
  return <PopoverFormCutOutLeftIcon />;
}

export default PopoverForm;
