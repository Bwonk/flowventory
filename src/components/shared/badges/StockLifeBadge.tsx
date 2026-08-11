import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BADGE_BASE, BADGE_COLORS, BADGE_SIZE, type BadgeColor, type BadgeSize } from './badge-tokens';

interface StockLifeBadgeProps {
  /** Stok ömrü (gün). null = satış yok, ömür hesaplanamıyor. */
  days: number | null;
  size?: BadgeSize;
  className?: string;
}

/** Gün sayısına göre renk: ≤14 kritik, ≤30 uyarı, üzeri sağlıklı, satışsız nötr. */
function colorFor(days: number | null): BadgeColor {
  if (days === null) return 'neutral';
  if (days <= 14) return 'red';
  if (days <= 30) return 'amber';
  return 'green';
}

/**
 * Stok ömrü rozeti — mevcut stoğun kaç günlük satışa yettiğini renk koduyla gösterir.
 */
export function StockLifeBadge({ days, size = 'sm', className }: StockLifeBadgeProps) {
  const c = BADGE_COLORS[colorFor(days)];
  const label = days === null ? 'satışsız' : `${days.toLocaleString('tr-TR')} gün`;

  return (
    <Badge variant="outline" className={cn(BADGE_BASE, BADGE_SIZE[size], c.bg, c.text, 'tabular-nums', className)}>
      {label}
    </Badge>
  );
}
