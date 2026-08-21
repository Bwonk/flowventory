import { Badge, type BadgeSize, type BadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SellThroughBand } from '@/lib/reports/sell-through';

interface SellThroughBadgeProps {
  /** 0..1 arası oran. null = ne satış ne stok var, oran anlamsız. */
  rate: number | null;
  band: SellThroughBand | null;
  size?: BadgeSize;
  className?: string;
}

const BAND_VARIANT: Record<SellThroughBand, BadgeVariant> = {
  yüksek: 'success',
  normal: 'neutral',
  düşük: 'warning',
  satışsız: 'critical',
};

/**
 * Sell-through rozeti — dönem satışının eldeki mala oranını renkle gösterir.
 * Yüksek oran "mal eriyor", düşük oran "sermaye bağlı kaldı" demek.
 * Normal bant nötrdür: accent mavisi rozetlerde harcanmaz (DESIGN.md bütçesi).
 */
export function SellThroughBadge({ rate, band, size = 'sm', className }: SellThroughBadgeProps) {
  if (rate === null || band === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const label = `%${(rate * 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

  return (
    <Badge variant={BAND_VARIANT[band]} size={size} title={`Sell-through: ${band}`} className={cn('tabular-nums', className)}>
      {label}
    </Badge>
  );
}
