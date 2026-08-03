'use client';

import React, { useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductRow } from '../types';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
import { ProductThumb } from './atoms';

interface ProductTableProps {
  rows: ProductRow[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSelectProduct: (productId: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  rows,
  hasActiveFilters,
  onClearFilters,
  onSelectProduct,
  hasMore,
  onLoadMore,
  loadingMore,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-background">
      {rows.length === 0 && !loadingMore ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Package className="h-8 w-8 text-hairline" />
          <p className="text-[18px] leading-[1.4] text-slate">
            {hasActiveFilters ? 'Seçili filtrelerle eşleşen ürün bulunamadı.' : 'Henüz ürün bulunamadı.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[14px] font-medium text-action-blue underline-offset-4 hover:underline"
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-background">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className={`w-[48px] px-3 py-3 text-center font-mono text-[12px] uppercase tracking-[0.08em] text-slate`}>
                  #
                </TableHead>
                <TableHead className={`w-[72px] px-3 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-slate`}>
                  Görsel
                </TableHead>
                <TableHead className={`px-3 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-slate`}>
                  Ürün Bilgileri
                </TableHead>
                <TableHead className={`px-3 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-slate`}>
                  Durum
                </TableHead>
                <TableHead className={`px-3 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-slate`}>
                  Görüntülenme
                </TableHead>
                <TableHead className={`px-3 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-slate`}>
                  Stok Ömrü
                </TableHead>
                <TableHead className="px-3 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-slate">
                  Toplam Stok
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => {
                const isZero = row.totalStock === 0;
                const rowNumber = rowIndex + 1;
                return (
                  <TableRow
                    key={row.productId}
                    className="group cursor-pointer border-b border-border transition-colors hover:bg-muted"
                    onClick={() => onSelectProduct(row.productId)}
                  >
                    <TableCell className={`w-[48px] px-3 py-3 text-center align-middle`}>
                      <span className="font-mono text-[14px] tabular-nums text-slate">
                        {String(rowNumber).padStart(2, '0')}
                      </span>
                    </TableCell>
                    <TableCell className={`w-[72px] px-3 py-3 align-middle`}>
                      <ProductThumb src={row.thumbnail} alt={row.productName} />
                    </TableCell>
                    <TableCell className={`px-3 py-3 align-middle`}>
                      <div className="flex flex-col gap-1">
                        <span className="text-[16px] font-medium text-primary transition-colors group-hover:text-action-blue">
                          {row.productName}
                        </span>
                        <span className="flex items-center gap-2 text-[14px] text-slate">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-hairline" />
                          {row.variantCount} varyant
                        </span>
                        {row.category && (
                          <span className="mt-1 inline-flex w-fit rounded-full bg-pale-blue px-2.5 py-0.5 text-[12px] font-medium text-action-blue">
                            {row.category}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`px-3 py-3 align-middle`}>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className={`px-3 py-3 align-middle`}>
                      {row.viewCount != null ? (
                        <div>
                          <p className="text-lg font-semibold text-primary">{row.viewCount}</p>
                          <p className="mt-0.5 text-xs text-slate">Son 30 gün</p>
                        </div>
                      ) : (
                        <p className="text-lg text-hairline">—</p>
                      )}
                    </TableCell>
                    <TableCell className={`px-3 py-3 align-middle`}>
                      {(() => {
                        const d = row.daysRemaining;
                        if (d === 0) {
                          return <p className="text-sm font-medium text-destructive">Tükendi</p>;
                        }
                        if (d == null) {
                          return (
                            <div>
                              <p className="text-lg text-hairline">—</p>
                              <p className="mt-0.5 text-xs text-slate">Satış yok</p>
                            </div>
                          );
                        }
                        if (d <= 7) {
                          return (
                            <div>
                              <p className="text-lg font-semibold text-destructive">{d} gün</p>
                              <p className="mt-0.5 text-xs text-destructive">Kritik</p>
                            </div>
                          );
                        }
                        if (d <= 30) {
                          return (
                            <div>
                              <p className="text-lg font-semibold text-amber-600">{d} gün</p>
                              <p className="mt-0.5 text-xs text-amber-600">Yakında biter</p>
                            </div>
                          );
                        }
                        if (d > 365) {
                          return (
                            <div>
                              <p className="text-lg font-semibold text-primary">365+ gün</p>
                              <p className="mt-0.5 text-xs text-slate">Fazla stok</p>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <p className="text-lg font-semibold text-primary">{d} gün</p>
                            <p className="mt-0.5 text-xs text-slate">Yeterli</p>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="px-3 py-3 align-middle">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-[24px] font-medium tracking-[-0.02em] ${isZero ? 'text-destructive' : 'text-primary'}`}
                        >
                          {row.totalStock}
                        </span>
                        <span className="text-[14px] text-slate">Adet</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {loadingMore && (
                [...Array(3)].map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="border-b border-border">
                    <TableCell className={`w-[48px] px-3 py-3`}>
                      <div className="mx-auto h-5 w-6 animate-pulse rounded bg-soft-stone" />
                    </TableCell>
                    <TableCell className={`w-[72px] px-3 py-3`}>
                      <div className="h-10 w-10 animate-pulse rounded bg-soft-stone" />
                    </TableCell>
                    <TableCell className={`px-3 py-3`}>
                      <div className="flex flex-col gap-2">
                        <div className="h-4 w-40 animate-pulse rounded bg-soft-stone" />
                        <div className="h-3 w-24 animate-pulse rounded bg-soft-stone" />
                      </div>
                    </TableCell>
                    <TableCell className={`px-3 py-3`}>
                      <div className="h-6 w-16 animate-pulse rounded-full bg-soft-stone" />
                    </TableCell>
                    <TableCell className={`px-3 py-3`}>
                      <div className="h-4 w-12 animate-pulse rounded bg-soft-stone" />
                    </TableCell>
                    <TableCell className={`px-3 py-3`}>
                      <div className="h-4 w-14 animate-pulse rounded bg-soft-stone" />
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="h-5 w-16 animate-pulse rounded bg-soft-stone" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} />

          {/* End-of-list message */}
          {!hasMore && rows.length > 0 && !loadingMore && (
            <div className="border-t border-border px-6 py-4 text-center">
              <p className="text-[14px] text-slate">Tüm ürünler yüklendi</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
