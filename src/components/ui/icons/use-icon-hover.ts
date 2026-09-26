'use client';

import { useMemo, useRef } from 'react';
import type {
  ForwardRefExoticComponent,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefAttributes,
} from 'react';
import { useReducedMotion } from 'motion/react';

/** `src/components/ui/icons/*` altındaki her animasyonlu ikonun imperative handle'ı. */
export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

/** Animasyonlu ikon bileşenlerinin ortak tipi — ikon dizisi/haritası tiplemek için. */
export type AnimatedIcon = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<AnimatedIconHandle>
>;

/**
 * Animasyonlu ikonun hover'ını ikonun kendisi yerine bir ÜST elemandan sürer.
 *
 * Gerekçe: ikonlar 16px; ayrıca `Button` içinde `[&_svg]:pointer-events-none`,
 * sidebar'da ise boyut kuralı `[&>svg]` direkt-çocuk seçicisi var. Hover'ın
 * satır/buton üzerinden gelmesi hem beklenen davranış hem de tek çalışan yol.
 * İkona `ref` bağlandığı anda kendi hover'ı kapanır ve kontrol buraya geçer.
 *
 * `prefers-reduced-motion` burada merkezî olarak ele alınır — kullanım
 * noktasında ayrıca kontrol etme. Dokunmatik girişte (pointerType `touch`)
 * hover animasyonu oynamaz; fare ve kalem oynatır.
 *
 * @example
 * const { ref, hoverProps } = useIconHover<EyeIconHandle>();
 * <Link {...hoverProps}><EyeIcon ref={ref} size={16} className="flex" /></Link>
 */
export function useIconHover<T extends AnimatedIconHandle = AnimatedIconHandle>() {
  const ref = useRef<T>(null);
  // Son pointer'ın türü — dokunmada tarayıcı `pointerenter`'dan SONRA uyumluluk
  // `mouseenter`'ı da ateşler; o tıklamada ikon oynayıp takılı kalmasın.
  const pointerTypeRef = useRef<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const hoverProps = useMemo(
    () => ({
      onPointerEnter: (e: ReactPointerEvent<Element>) => {
        pointerTypeRef.current = e.pointerType;
      },
      // Olaysız çağrı (ör. `hoverProps.onMouseEnter()` ile elle sürme) her zaman oynatır.
      onMouseEnter: (e?: ReactMouseEvent<Element>) => {
        if (e && pointerTypeRef.current === 'touch') return;
        if (!prefersReducedMotion) ref.current?.startAnimation();
      },
      onMouseLeave: () => ref.current?.stopAnimation(),
    }),
    [prefersReducedMotion],
  );

  return { ref, hoverProps, prefersReducedMotion };
}
