import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BADGE_BASE, BADGE_SIZE, type BadgeSize } from './badge-tokens';

interface CategoryBadgeProps {
  name: string;
  size?: BadgeSize;
  className?: string;
}

/**
 * Kategori/etiket rozeti — nötr yüzey, vurgu rengi yok.
 * (DESIGN.md: taksonomi öğeleri sessiz kalır, durum renkleri yalnızca duruma.)
 */
export function CategoryBadge({ name, size = 'sm', className }: CategoryBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(BADGE_BASE, BADGE_SIZE[size], 'bg-accent text-accent-foreground', className)}
    >
      {name}
    </Badge>
  );
}
