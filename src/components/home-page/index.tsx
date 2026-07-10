"use client"

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HomePageProps, Product } from './types';
import { useProductFilters } from './hooks/use-product-filters';
import { MonoLabel } from './components/atoms';
import { FilterBar } from './components/FilterBar';
import { ProductTable } from './components/ProductTable';
import { Pagination } from './components/Pagination';
import { TopSellers } from './components/TopSellers';
import { ProductDetailModal } from './product-detail/ProductDetailModal';
import { downloadCSV } from './lib/csv';

const HomePage: React.FC<HomePageProps> = ({ token, products = [], analytics, loading }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const filters = useProductFilters(products);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#ffffff] font-sans">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <MonoLabel>Flowventory</MonoLabel>
            <h1 className="text-4xl font-normal leading-none tracking-[-0.03em] text-[#17171c] sm:text-5xl">
              Kimlik Doğrulama Gerekli
            </h1>
            <p className="text-[16px] leading-[1.5] text-[#616161]">
              Uygulama eylemlerini kullanmak için lütfen ikas üzerinden kimlik doğrulaması yapın.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ffffff] font-sans">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 h-4 w-32 animate-pulse rounded-full bg-[#eeece7]" />
          <div className="mb-10 h-12 w-64 animate-pulse rounded-[8px] bg-[#eeece7]" />
          <div className="mb-6 h-40 w-full animate-pulse rounded-[22px] bg-[#eeece7]" />
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[16px] bg-[#eeece7]" />
            ))}
          </div>
          <div className="h-64 w-full animate-pulse rounded-[16px] bg-[#eeece7]" />
        </div>
      </div>
    );
  }

  const topProducts = analytics?.topProducts ?? [];

  return (
    <div className="min-h-screen bg-[#ffffff] font-sans text-[#212121]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Başlık */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#75758a]">
              STOK YÖNETİMİ
            </p>
            <h1 className="text-3xl font-normal tracking-[-0.03em] text-[#17171c]">Stok Takibi</h1>
          </div>
          <Button
            onClick={() => downloadCSV(filters.pagedRows)}
            className="h-auto gap-2 rounded-full bg-[#17171c] px-6 py-3 text-[14px] font-medium text-[#ffffff] shadow-none transition-colors hover:bg-[#000000]"
          >
            <Download className="h-4 w-4" />
            CSV İndir
          </Button>
        </header>

        {/* Birleşik filtre konteyneri */}
        <FilterBar
          query={filters.query}
          onQueryChange={filters.setQuery}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={filters.setStatusFilter}
          stockRange={filters.stockRange}
          onStockRangeChange={filters.setStockRange}
          sortBy={filters.sortBy}
          onSortByChange={filters.setSortBy}
          hasActiveFilters={filters.hasActiveFilters}
          onClearAll={filters.clearAllFilters}
        />

        {/* Ürün tablosu */}
        <ProductTable
          rows={filters.pagedRows}
          hasActiveFilters={filters.hasActiveFilters}
          onClearFilters={filters.clearAllFilters}
          onSelectProduct={productId => {
            const product = products.find(p => p.id === productId);
            if (product) setSelectedProduct(product);
          }}
        />

        {/* Pagination */}
        {filters.totalResults > 0 && (
          <Pagination
            page={filters.page}
            totalPages={filters.totalPages}
            totalResults={filters.totalResults}
            visibleCount={filters.pagedRows.length}
            onPrev={() => filters.setPage(filters.page - 1)}
            onNext={() => filters.setPage(filters.page + 1)}
          />
        )}

        {/* En çok satanlar */}
        <TopSellers topProducts={topProducts} />
      </div>

      {/* Ürün detay modalı */}
      <ProductDetailModal
        product={selectedProduct}
        analytics={analytics}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};

export default HomePage;
