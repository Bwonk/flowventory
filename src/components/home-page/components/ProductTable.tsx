'use client';

import React from 'react';
import { Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductRow } from '../types';
import { ProductThumb, StatusBadge } from './atoms';

interface ProductTableProps {
  rows: ProductRow[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSelectProduct: (productId: string) => void;
}

/** Ürün listesi tablosu: en kötü varyant durumu + toplam stok, satır tıklamayla detay. */
export const ProductTable: React.FC<ProductTableProps> = ({
  rows,
  hasActiveFilters,
  onClearFilters,
  onSelectProduct,
}) => (
  <div className="overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-[#ffffff]">
    {rows.length === 0 ? (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Package className="h-8 w-8 text-[#d9d9dd]" />
        <p className="text-[18px] leading-[1.4] text-[#75758a]">
          {hasActiveFilters ? 'Seçili filtrelerle eşleşen ürün bulunamadı.' : 'Henüz ürün bulunamadı.'}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[14px] font-medium text-[#1863dc] underline-offset-4 hover:underline"
          >
            Filtreleri temizle
          </button>
        )}
      </div>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#ffffff]">
            <TableRow className="border-b border-[#e5e7eb] hover:bg-transparent">
              <TableHead className="w-[72px] px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                Görsel
              </TableHead>
              <TableHead className="px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                Ürün Bilgileri
              </TableHead>
              <TableHead className="px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                Durum
              </TableHead>
              <TableHead className="px-6 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a]">
                Toplam Stok
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const isZero = row.totalStock === 0;
              return (
                <TableRow
                  key={row.productId}
                  className="group cursor-pointer border-b border-[#e5e7eb] transition-colors hover:bg-[#f2f2f2]"
                  onClick={() => onSelectProduct(row.productId)}
                >
                  <TableCell className="px-6 py-5 align-top">
                    <ProductThumb src={row.thumbnail} alt={row.productName} />
                  </TableCell>
                  <TableCell className="px-6 py-5 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-[16px] font-medium text-[#17171c] transition-colors group-hover:text-[#1863dc]">
                        {row.productName}
                      </span>
                      <span className="flex items-center gap-2 text-[14px] text-[#75758a]">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d9d9dd]" />
                        {row.variantCount} varyant
                      </span>
                      {row.category && (
                        <span className="mt-1 inline-flex w-fit rounded-full bg-[#f1f5ff] px-2.5 py-0.5 text-[12px] font-medium text-[#1863dc]">
                          {row.category}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-5 align-top">
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="px-6 py-5 align-top">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-[24px] font-medium tracking-[-0.02em] ${isZero ? 'text-[#b30000]' : 'text-[#17171c]'}`}
                      >
                        {row.totalStock}
                      </span>
                      <span className="text-[14px] text-[#75758a]">Adet</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    )}
  </div>
);
