import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BADGE_BASE, BADGE_SIZE, BADGE_COLORS, type BadgeSize } from './badge-tokens';

export type StockStatus = 'healthy' | 'warning' | 'critical';

interface StatusBadgeProps {
  status: StockStatus;
  size?: BadgeSize;
  label?: string;
  showDot?: boolean;
  className?: string;
}

const STATUS_MAP: Record<StockStatus, { label: string; color: keyof typeof BADGE_COLORS }> = {
  healthy:  { label: 'Sağlıklı', color: 'green' },
  warning:  { label: 'Az Kalan', color: 'amber' },
  critical: { label: 'Tükendi',  color: 'red' },
};

export function StatusBadge({
  status,
  size = 'md',
  label,
  showDot = false,
  className,
}: StatusBadgeProps) {
  const { label: defaultLabel, color } = STATUS_MAP[status];
  const c = BADGE_COLORS[color];

  return (
    <Badge
      variant="outline"
      className={cn(BADGE_BASE, BADGE_SIZE[size], c.bg, c.text, className)}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />}
      {label ?? defaultLabel}
    </Badge>
  );
}
