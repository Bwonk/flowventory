'use client';

import type { ComponentProps, MouseEvent, PointerEvent } from 'react';
import { XMarkIcon } from '@/components/ui/icons/x-mark';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { cn } from '@/lib/utils';

/**
 * Kapat / vazgeç / temizle çarpısı — uygulamadaki tek çarpı butonu.
 *
 * - Hover'da çarpı yeniden çizilir (hareketli `XMarkIcon`, hover butondan sürülür).
 * - Basınca 0.9'a iner (150ms ease-out): ikon-butonu küçük olduğu için genel
 *   `PRESS_FEEDBACK_CLASS`'ın 0.99'u burada hissedilmiyordu. reduced-motion'da ölçek yok.
 * - Fareyle basınca halka/çerçeve çıkmaz; halka yalnız klavye odağında (`focus-visible`).
 *
 * Radix `*Close` parçalarıyla `asChild` üzerinden kullanılır; konum, boyut ve
 * renk `className`'den gelir.
 */
export function CloseButton({
  iconSize = 16,
  className,
  children,
  onPointerEnter,
  onMouseEnter,
  onMouseLeave,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { iconSize?: number }) {
  const icon = useIconHover();

  return (
    <button
      type={type}
      {...props}
      onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
        icon.hoverProps.onPointerEnter(event);
        onPointerEnter?.(event);
      }}
      onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => {
        icon.hoverProps.onMouseEnter(event);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => {
        icon.hoverProps.onMouseLeave();
        onMouseLeave?.(event);
      }}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md outline-none select-none [-webkit-touch-callout:none]',
        'transition-[color,background-color,opacity,scale] duration-150 ease-out active:scale-90 motion-reduce:active:scale-100',
        'focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      <XMarkIcon ref={icon.ref} size={iconSize} className="pointer-events-none flex" aria-hidden />
      {children}
    </button>
  );
}
