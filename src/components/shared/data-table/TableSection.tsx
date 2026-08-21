import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

interface TableSectionProps {
  title: string;
  /** "128 ürün listeleniyor" gibi alt satır. */
  count?: string;
  /** Çapraz filtre tıklamalarının scrollIntoView hedefi. */
  sectionRef?: Ref<HTMLElement>;
  children: ReactNode;
  className?: string;
}

/**
 * Kanonik tablo bölüm kartı (DESIGN.md data-ink): hairline kart + başlık şeridi.
 * children = filtre şeridi + tablo; kolon içerikleri sayfaya özeldir.
 */
export function TableSection({ title, count, sectionRef, children, className }: TableSectionProps) {
  return (
    <section
      ref={sectionRef}
      className={cn('scroll-mt-4 overflow-hidden rounded-lg border border-hairline bg-card', className)}
    >
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {count && <p className="text-xs text-muted-foreground">{count}</p>}
      </div>
      {children}
    </section>
  );
}
