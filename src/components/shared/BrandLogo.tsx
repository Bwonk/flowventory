'use client';

import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import type { SVGAttributes } from 'react';
import { useAnimate } from 'motion/react';
import { ICON_SPRING } from '@/components/ui/icons/icon-motion';
import { EASE_IN_OUT } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Flowventory marka logosu — "Raf" işareti (DESIGN.md §5 "Marka logosu").
 *
 * F harfi bir raftır: gövde ve üst kol eldeki stok, orta kolun yerindeki lime
 * kare raftan çıkan ürün. Hover hikâyesi: ürün satılır (kare sağa çıkar), stok
 * düşer (üst kol kısalır), tedarik gelir (gövdeden yeni kare çıkar), raf dolar.
 * Dosya sürümleri ve PNG'ler `public/brand/` altında; geometri burada ve
 * oradaki SVG'lerde aynı 64'lük ızgaradır.
 */

export interface BrandMarkHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface BrandMarkProps extends Omit<SVGAttributes<SVGSVGElement>, 'ref'> {
  /** px cinsinden kenar uzunluğu. */
  size?: number;
}

/** Üst kolun kısalma miktarı ve kareye giriş/çıkış mesafeleri (64'lük ızgara). */
const ARM_SHIFT = -10;
const UNIT_EXIT = 12;
const UNIT_ENTER_FROM = -14;

/**
 * Kare uygulama ikonu. Hover parent'tan sürülür: `useIconHover<BrandMarkHandle>()`
 * ile `ref` + `hoverProps` al (reduced-motion ve dokunma orada ele alınır).
 */
export const BrandMark = forwardRef<BrandMarkHandle, BrandMarkProps>(
  ({ size = 32, className, ...props }, ref) => {
    const [scope, animate] = useAnimate<SVGSVGElement>();
    const playingRef = useRef(false);
    const clipId = `fv-arm-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    useImperativeHandle(ref, () => ({
      startAnimation: () => {
        if (playingRef.current || !scope.current) return;
        playingRef.current = true;
        void animate([
          ['[data-fv="unit"]', { x: UNIT_EXIT, opacity: 0 }, { duration: 0.18, ease: EASE_IN_OUT }],
          ['[data-fv="arm"]', { x: ARM_SHIFT }, { duration: 0.28, ease: EASE_IN_OUT, at: 0.1 }],
          // Yeni ürün gövdenin arkasında doğar (gövde üstte çizili), oradan kayarak çıkar.
          ['[data-fv="unit"]', { x: UNIT_ENTER_FROM, opacity: 1 }, { duration: 0, at: 0.4 }],
          ['[data-fv="unit"]', { x: 0 }, { ...ICON_SPRING, at: 0.4 }],
          ['[data-fv="arm"]', { x: 0 }, { ...ICON_SPRING, at: 0.52 }],
        ]).then(() => {
          playingRef.current = false;
        });
      },
      // Hikâye yarıda kesilmez: imleç ayrılsa da raf dolup durur.
      stopAnimation: () => {},
    }));

    return (
      <svg
        ref={scope}
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label="Flowventory"
        className={cn('shrink-0', className)}
        {...props}
      >
        <clipPath id={clipId}>
          <rect x="18" y="0" width="46" height="64" />
        </clipPath>
        <rect width="64" height="64" rx="16" className="fill-brand-ink" />
        <rect data-fv="unit" x="32" y="28" width="10" height="10" rx="3" className="fill-brand-lime" />
        <g clipPath={`url(#${clipId})`}>
          <rect data-fv="arm" x="18" y="14" width="28" height="10" rx="3" className="fill-brand-paper" />
        </g>
        <rect x="18" y="14" width="10" height="36" rx="3" className="fill-brand-paper" />
      </svg>
    );
  },
);

BrandMark.displayName = 'BrandMark';

/** Geist SemiBold, -0.035em; eğriye çevrili. viewBox dikeyde cap yüksekliğine ortalı. */
const WORDMARK_PATH =
  'M80 0V-710H555V-597H210V-403H537V-291H210V0ZM743 0Q684 0 649.5 -30Q615 -60 615 -126V-710H743V-139Q743 -99 783 -99H822V0ZM1101 12Q1022 12 962.5 -22.5Q903 -57 870.5 -119.5Q838 -182 838 -267Q838 -352 870.5 -414.5Q903 -477 962.5 -511.5Q1022 -546 1101 -546Q1180 -546 1239 -511.5Q1298 -477 1330.5 -414.5Q1363 -352 1363 -267Q1363 -182 1330.5 -119.5Q1298 -57 1239 -22.5Q1180 12 1101 12ZM1101 -92Q1162 -92 1196 -138Q1230 -184 1230 -267Q1230 -350 1196 -396Q1162 -442 1101 -442Q1039 -442 1005 -396Q971 -350 971 -267Q971 -184 1005 -138Q1039 -92 1101 -92ZM1521 0 1360 -534H1491L1595 -145L1702 -534H1814L1922 -145L2026 -534H2157L1996 0H1864L1758 -358L1653 0ZM2359 0 2164 -534H2299L2435 -129L2571 -534H2706L2511 0ZM2965 12Q2885 12 2826 -22.5Q2767 -57 2735 -120Q2703 -183 2703 -267Q2703 -351 2735 -414Q2767 -477 2825.5 -511.5Q2884 -546 2962 -546Q3038 -546 3095 -512Q3152 -478 3183.5 -414Q3215 -350 3215 -260V-231H2836Q2839 -161 2874 -125.5Q2909 -90 2966 -90Q3053 -90 3077 -164L3208 -156Q3186 -78 3121.5 -33Q3057 12 2965 12ZM2836 -317H3083Q3078 -382 3045.5 -413.5Q3013 -445 2962 -445Q2910 -445 2877 -412Q2844 -379 2836 -317ZM3280 0V-534H3396L3399 -443Q3421 -498 3463.5 -522Q3506 -546 3559 -546Q3647 -546 3694 -489.5Q3741 -433 3741 -343V0H3613V-302Q3613 -370 3592.5 -406Q3572 -442 3520 -442Q3468 -442 3438 -406Q3408 -370 3408 -302V0ZM4023 0Q3943 0 3905.5 -36.5Q3868 -73 3868 -153V-435H3784V-534H3868V-659H3996V-534H4137V-435H3996V-165Q3996 -127 4012.5 -113Q4029 -99 4062 -99H4137V0ZM4419 12Q4340 12 4280.5 -22.5Q4221 -57 4188.5 -119.5Q4156 -182 4156 -267Q4156 -352 4188.5 -414.5Q4221 -477 4280.5 -511.5Q4340 -546 4419 -546Q4498 -546 4557 -511.5Q4616 -477 4648.5 -414.5Q4681 -352 4681 -267Q4681 -182 4648.5 -119.5Q4616 -57 4557 -22.5Q4498 12 4419 12ZM4419 -92Q4480 -92 4514 -138Q4548 -184 4548 -267Q4548 -350 4514 -396Q4480 -442 4419 -442Q4357 -442 4323 -396Q4289 -350 4289 -267Q4289 -184 4323 -138Q4357 -92 4419 -92ZM4745 0V-534H4865L4868 -430Q4884 -484 4915 -509Q4946 -534 4996 -534H5045V-424H4995Q4934 -424 4903.5 -396.5Q4873 -369 4873 -308V0ZM5134 150V51H5202Q5228 51 5240.5 43Q5253 35 5260 16L5275 -21H5238L5047 -534H5180L5314 -141L5442 -534H5575L5366 56Q5348 106 5315.5 128Q5283 150 5225 150Z';
const WORDMARK_VIEWBOX = { x: 80, y: -860, width: 5495, height: 1010 } as const;

interface BrandWordmarkProps extends SVGAttributes<SVGSVGElement> {
  /** px cinsinden yükseklik. 32px işaretin yanında 18 (cap ≈ işaretin %40'ı). */
  height?: number;
}

/** "Flowventory" yazısı. Rengi `currentColor`'dan alır; varsayılan marka mürekkebi. */
export function BrandWordmark({ height = 18, className, ...props }: BrandWordmarkProps) {
  const { x, y, width: w, height: h } = WORDMARK_VIEWBOX;
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      height={height}
      width={(height * w) / h}
      aria-hidden
      className={cn('shrink-0 text-brand-ink', className)}
      {...props}
    >
      <path fill="currentColor" d={WORDMARK_PATH} />
    </svg>
  );
}
