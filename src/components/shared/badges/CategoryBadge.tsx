import { Badge, type BadgeSize } from '@/components/ui/badge';

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
    <Badge variant="neutral" size={size} className={className}>
      {name}
    </Badge>
  );
}
