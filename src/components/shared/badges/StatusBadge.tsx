import { Badge, type BadgeSize, type BadgeVariant } from '@/components/ui/badge';
import { STATUS_META } from '@/lib/products/constants';
import { cn } from '@/lib/utils';

export type StockStatus = 'healthy' | 'warning' | 'critical' | 'out';

interface StatusBadgeProps {
  status: StockStatus;
  size?: BadgeSize;
  label?: string;
  showDot?: boolean;
  className?: string;
}

/** Durum → badge varyantı. 'out' ve 'critical' aynı renkte; ayrımı etiket taşır. */
const STATUS_VARIANT: Record<StockStatus, BadgeVariant> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'critical',
  out: 'critical',
};

/** Durum → sinyal dot rengi (DESIGN.md: dotlar --status-* üçlüsünden). */
const STATUS_DOT: Record<StockStatus, string> = {
  healthy: 'bg-status-healthy',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical',
  out: 'bg-status-critical',
};

export function StatusBadge({ status, size = 'sm', label, showDot = false, className }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} size={size} className={className}>
      {showDot && <span className={cn('size-2 rounded-full', STATUS_DOT[status])} />}
      {label ?? STATUS_META[status].label}
    </Badge>
  );
}
