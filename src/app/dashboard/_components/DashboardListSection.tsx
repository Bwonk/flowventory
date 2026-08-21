import type { ReactNode } from 'react';
import { TableSection } from '@/components/shared/data-table/TableSection';

interface DashboardListSectionProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Dashboard liste bölümü: kanonik TableSection + görünür başlık şeridi.
 * Stok/analiz sayfalarında bağlamı PageHeader taşıdığı için başlık şeridi yok;
 * dashboard birden çok bölümü üst üste dizdiğinden bölüm adı burada görünür kalır.
 */
export function DashboardListSection({ title, subtitle, badge, children, className }: DashboardListSectionProps) {
  return (
    <TableSection label={title} className={className}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {children}
    </TableSection>
  );
}
