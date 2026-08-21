import { TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, type BadgeSize } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
export function TrendBadge({ value, size = 'sm', className }: TrendBadgeProps) {
  const isFlat = value === 0;
  const isUp = value > 0;

  return (
    <Badge
      variant={isFlat ? 'neutral' : isUp ? 'success' : 'critical'}
      size={size}
      className={cn('tabular-nums', className)}
    >
      {!isFlat && (isUp ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />)}
      {isUp ? '+' : ''}
      {value}%
    </Badge>
  );
}
