import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

interface TableSectionProps {
  /**
   * Erişilebilir bölüm adı. Görsel başlık şeridi bilinçli olarak yoktur:
   * sayfa başlığı ve filtre şeridi bağlamı zaten taşıyor (data-ink).
   */
  label: string;
  /** Çapraz filtre tıklamalarının scrollIntoView hedefi. */
  sectionRef?: Ref<HTMLElement>;
  children: ReactNode;
  className?: string;
}

/**
 * Kanonik tablo bölüm kartı (DESIGN.md data-ink): hairline kart.
 * children = filtre şeridi + tablo; kolon içerikleri sayfaya özeldir.
 */
export function TableSection({ label, sectionRef, children, className }: TableSectionProps) {
  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={cn('scroll-mt-4 overflow-hidden rounded-lg border border-hairline bg-card', className)}
    >
      {children}
    </section>
  );
}
