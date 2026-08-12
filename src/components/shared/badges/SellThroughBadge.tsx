import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SellThroughBand } from '@/lib/reports/sell-through';
import { BADGE_BASE, BADGE_COLORS, BADGE_SIZE, type BadgeColor, type BadgeSize } from './badge-tokens';

interface SellThroughBadgeProps {
  /** 0..1 arası oran. null = ne satış ne stok var, oran anlamsız. */
  rate: number | null;
  band: SellThroughBand | null;
  size?: BadgeSize;
  className?: string;
}

const BAND_COLOR: Record<SellThroughBand, BadgeColor> = {
  yüksek: 'green',
  normal: 'blue',
  düşük: 'amber',
  satışsız: 'red',
};

/**
 * Sell-through rozeti — dönem satışının eldeki mala oranını renkle gösterir.
 * Yüksek oran "mal eriyor", düşük oran "sermaye bağlı kaldı" demek.
 */
export function SellThroughBadge({ rate, band, size = 'sm', className }: SellThroughBadgeProps) {
  if (rate === null || band === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const c = BADGE_COLORS[BAND_COLOR[band]];
  const label = `%${(rate * 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

  return (
    <Badge
      variant="outline"
      title={`Sell-through: ${band}`}
      className={cn(BADGE_BASE, BADGE_SIZE[size], c.bg, c.text, 'tabular-nums', className)}
    >
      {label}
    </Badge>
  );
}
