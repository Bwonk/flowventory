import { cn } from '@/lib/utils';

interface ConcaveFilletProps {
  /** Kavisin baktığı yön: raf/tab'ın hangi dış kenarına bağlanıyor. */
  side: 'left' | 'right';
  /** Konum override'ı (ör. sarmalayıcı içinde "left-0 top-0! h-full!"). */
  className?: string;
}

/**
 * Yüzeyi (tab, aksiyon rafı, KPI rafı) alttaki karta bağlayan içbükey yan
 * silüet — "Akışkan S" (onaylanan tasarım yönü A): kart kenarlığından yüzeyin
 * üst kenarlığına iki uçta da yatay teğet TEK sürekli eğri. Eğri değerleri
 * tasarım tuvalindeki mock'la birebir (30px taban, asimetrik kontrol
 * noktaları — Chrome sekme dili) ve rapor sayfasındaki TÜM kavisli yüzeylerde
 * aynıdır. preserveAspectRatio="none" yüzey yüksekliğine esner,
 * non-scaling-stroke hairline'ı 1px tutar.
 *
 * Boyutlar `!` ile ve yükseklik AÇIKÇA verilir: SVG replaced element
 * olduğundan `top`+`bottom` ankrajı esnetmez; ayrıca TabsTrigger/Button gibi
 * ebeveynlerin `[&_svg:not([class*='size-'])]:size-4` ikon kuralı boyutu
 * eziyor.
 */
export function ConcaveFillet({ side, className }: ConcaveFilletProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 30 41"
      preserveAspectRatio="none"
      fill="none"
      className={cn(
        'pointer-events-none absolute -top-px h-[calc(100%+1px)]! w-[30px]!',
        side === 'left' ? '-left-[30px]' : '-right-[30px]',
        className,
      )}
    >
      {side === 'left' ? (
        <>
          <path d="M0 41 C14 41 8 0 30 0 L30 41 Z" fill="var(--card)" />
          <path d="M0 40.5 C14 40.5 8 0.5 30 0.5" stroke="var(--hairline)" vectorEffect="non-scaling-stroke" />
        </>
      ) : (
        <>
          <path d="M30 41 C16 41 22 0 0 0 L0 41 Z" fill="var(--card)" />
          <path d="M30 40.5 C16 40.5 22 0.5 0 0.5" stroke="var(--hairline)" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}
