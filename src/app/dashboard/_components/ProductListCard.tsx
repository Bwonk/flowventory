'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import type { StockStatus } from '@/components/shared/badges/StatusBadge';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
import {
  DataTable,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from '@/components/shared/data-table/data-table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { TableFooterNote } from '@/components/shared/data-table/TableFooterNote';
import { ProductThumb } from '@/components/shared/filters/atoms';
import { DashboardListSection } from './DashboardListSection';

export interface ProductListItem {
  productId: string;
  index: number;
  image?: string;
  name: string;
  /** Ürün adının altındaki ikincil satır. */
  meta?: string;
  status?: StockStatus;
  /** Sağdaki sayısal kolon (satış adedi / toplam stok). */
  value: number;
}

interface ProductListCardProps {
  title: string;
  subtitle: string;
  badge?: { label: string; variant: BadgeVariant };
  items: ProductListItem[];
  /** Sayısal kolonun başlığı ("Adet", "Stok"...). */
  valueHeader: string;
  /** Verilirse durum kolonu bu başlıkla render edilir. */
  statusHeader?: string;
  /** Tam sonuç sayısı; items.length'ten büyükse kesme notu gösterilir. */
  totalCount?: number;
  viewAllHref?: string;
  emptyState: {
    icon: LucideIcon;
    message: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
}

/** Dashboard ürün listesi — kanonik DataTable düzeni (stok tablosuyla aynı dialekt). */
export const ProductListCard: React.FC<ProductListCardProps> = ({
  title,
  subtitle,
  badge,
  items,
  valueHeader,
  statusHeader,
  totalCount,
  viewAllHref,
  emptyState,
}) => {
  const router = useRouter();
  const truncated = totalCount != null && totalCount > items.length;

  return (
    <DashboardListSection
      title={title}
      subtitle={subtitle}
      badge={badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={emptyState.icon}
          message={emptyState.message}
          description={emptyState.description}
          actionLabel={emptyState.actionLabel}
          onAction={emptyState.onAction}
        />
      ) : (
        <>
          <DataTable>
            <DataTableHeaderRow>
              <DataTableHeadCell edge align="center" className="w-[48px]">#</DataTableHeadCell>
              <DataTableHeadCell>Ürün</DataTableHeadCell>
              {statusHeader && <DataTableHeadCell>{statusHeader}</DataTableHeadCell>}
              <DataTableHeadCell align="right" edge>{valueHeader}</DataTableHeadCell>
            </DataTableHeaderRow>
            <tbody>
              {items.map(item => (
                <DataTableRow
                  key={item.productId}
                  onClick={() => router.push(`/dashboard/stok?product=${item.productId}`)}
                >
                  <DataTableCell edge align="center" className="w-[48px]">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {String(item.index).padStart(2, '0')}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2.5">
                      <ProductThumb src={item.image} alt="" sizeClass="h-7 w-7" roundedClass="rounded" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{item.name}</p>
                        {item.meta && <p className="truncate text-xs text-muted-foreground">{item.meta}</p>}
                      </div>
                    </div>
                  </DataTableCell>
                  {statusHeader && (
                    <DataTableCell>
                      {item.status ? (
                        <StatusBadge status={item.status} size="sm" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </DataTableCell>
                  )}
                  <DataTableCell numeric edge className="font-medium">
                    {item.value}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
          <TableFooterNote>
            {truncated ? (
              <>
                İlk {items.length} ürün gösteriliyor
                {viewAllHref && (
                  <>
                    {' · '}
                    <Link
                      href={viewAllHref}
                      className="font-medium text-accent-blue underline-offset-4 hover:underline"
                    >
                      Tümünü gör &rarr;
                    </Link>
                  </>
                )}
              </>
            ) : (
              <>{items.length} ürün listelendi</>
            )}
          </TableFooterNote>
        </>
      )}
    </DashboardListSection>
  );
};
