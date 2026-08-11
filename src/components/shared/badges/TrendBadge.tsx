import { TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BADGE_BASE, BADGE_COLORS, BADGE_SIZE, type BadgeSize } from './badge-tokens';

interface TrendBadgeProps {
  /** Yüzde değişim (ör. +12, -8, 0). */
  value: number;
  size?: BadgeSize;
  className?: string;
}

/**
 * Yüzde değişim rozeti: artış yeşil (▲), düşüş kırmızı (▼), değişim yoksa nötr.
 * Dashboard KPI'ları ve trend gösterimleri için ortak bileşen.
 */
export function TrendBadge({ value, size = 'md', className }: TrendBadgeProps) {
  const isFlat = value === 0;
  const isUp = value > 0;
  const c = BADGE_COLORS[isFlat ? 'neutral' : isUp ? 'green' : 'red'];

  return (
    <Badge variant="outline" className={cn(BADGE_BASE, BADGE_SIZE[size], c.bg, c.text, className)}>
      {!isFlat && (isUp ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />)}
      {isUp ? '+' : ''}
      {value}%
    </Badge>
  );
}
