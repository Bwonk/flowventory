import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AbcClass } from '@/lib/reports/abc';

interface AbcBadgeProps {
  cls: AbcClass;
  className?: string;
}

/**
 * ABC sınıf rozeti — renkli taksonomi, DESIGN.md'ye bilinçli istisna:
 * A/B/C renk kodu tarama hızını artırdığı için durum çiftleri ödünç alınır.
 * Tek boyut (h-5) — kart ve tablo aynı rozeti kullanır.
 */
const ABC_VARIANT: Record<AbcClass, BadgeVariant> = {
  A: 'success',
  B: 'warning',
  C: 'neutral',
};

export function AbcBadge({ cls, className }: AbcBadgeProps) {
  return (
    <Badge
      variant={ABC_VARIANT[cls]}
      className={cn('h-5 w-5 justify-center p-0 text-[11px] font-semibold', className)}
    >
      {cls}
    </Badge>
  );
}
