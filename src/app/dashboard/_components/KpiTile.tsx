import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiTileProps {
  icon: LucideIcon;
  /** Mono uppercase eyebrow ("SON 30 GÜN CİRO"). */
  label: string;
  value: ReactNode;
  /** Değer satırının içinde, hemen altında küçük not ("~tahmini"). */
  valueSuffix?: ReactNode;
  footer?: ReactNode;
  /** Verilirse karo Link olur; cta satırı dinlenme affordance'ıdır. */
  href?: string;
  cta?: string;
  /** Grid span sınıfları için. */
  className?: string;
  /** Verilirse tek seferlik giriş animasyonu bu sırayla gecikir (animate-enter). */
  stagger?: number;
}

/**
 * KPI şeridi karosu. Ayraçlar hücrenin sağ/alt kenarlığında olmalı:
 * grid'in -mr/-mb px hilesi son satır/sütunun fazla çizgisini kırpıyor.
 */
export function KpiTile({
  icon: Icon,
  label,
  value,
  valueSuffix,
  footer,
  href,
  cta,
  className,
  stagger,
}: KpiTileProps) {
  const content = (
    <>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-mono text-xl font-medium tabular-nums text-foreground @7xl:text-2xl">
        {value}
        {valueSuffix}
      </p>
      <div className="mt-auto pt-3">
        {footer}
        {href && cta && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            {cta}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
          </span>
        )}
      </div>
    </>
  );

  const baseClass = cn(
    'flex flex-col border-b border-r border-border p-5',
    stagger != null && 'animate-enter',
    className,
  );
  const staggerStyle = stagger != null ? ({ '--stagger': stagger } as CSSProperties) : undefined;

  if (href) {
    return (
      <Link
        href={href}
        style={staggerStyle}
        className={cn(
          baseClass,
          'group cursor-pointer transition-colors duration-150 hover:bg-muted/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div style={staggerStyle} className={baseClass}>
      {content}
    </div>
  );
}
