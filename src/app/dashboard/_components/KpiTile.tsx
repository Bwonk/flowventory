import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiTileProps {
  icon: LucideIcon;
  /** Mono uppercase eyebrow ("SON 30 GÜN CİRO"). */
  label: string;
  value: ReactNode;
  /** Değer satırının içinde, hemen altında küçük not ("~tahmini"). */
  valueSuffix?: ReactNode;
  /** Tek satır kompakt alt bilgi (truncate edilir). */
  footer?: ReactNode;
  /** Verilirse karo Link olur; dinlenme affordance'ı sağ üstteki köşe okudur. */
  href?: string;
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
  className,
  stagger,
}: KpiTileProps) {
  const content = (
    <>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {href && (
          <span className="ml-auto shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        )}
      </div>
      <div className="mt-2 min-w-0">
        <p className="truncate font-mono text-lg font-medium tabular-nums text-foreground @5xl:text-xl @7xl:text-2xl">
          {value}
        </p>
        {valueSuffix}
      </div>
      <div className="mt-auto min-w-0 pt-3">{footer}</div>
    </>
  );

  const baseClass = cn(
    'flex min-w-0 flex-col border-b border-r border-border p-5',
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
