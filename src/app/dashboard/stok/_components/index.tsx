"use client"

import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import type { HomePageProps, Product } from '@/lib/products/types';
import { useProductFilters } from './hooks/use-product-filters';
import { MonoLabel } from '@/components/shared/filters/atoms';
import { TableSection } from '@/components/shared/data-table/TableSection';
import { FilterBar } from './components/FilterBar';
import { ProductTable } from './components/ProductTable';
import { ProductDetailModal } from './product-detail/ProductDetailModal';
import { downloadCSV } from '@/lib/products/csv';

const HomePage: React.FC<HomePageProps> = ({ token, products = [], analytics, viewStats, loading, initialStatusFilter, initialSelectedProductId, onVariantStockChange }) => {
  // Nesne kopyası değil kimlik tutulur: stok düzenlemesi listeyi güncelleyince modal da güncel ürünü görür.
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedProduct = useMemo<Product | null>(
    () => (selectedProductId ? products.find(p => p.id === selectedProductId) ?? null : null),
    [products, selectedProductId],
  );
  const salesByVariant = analytics?.salesByVariant ?? [];
  const filters = useProductFilters(products, viewStats, salesByVariant, initialStatusFilter);

  useEffect(() => {
    if (initialSelectedProductId && products.some(p => p.id === initialSelectedProductId)) {
      setSelectedProductId(initialSelectedProductId);
    }
  }, [initialSelectedProductId, products]);

  if (!token) {
    return (
      <div className="font-sans">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <MonoLabel>Flowventory</MonoLabel>
            <h1 className="text-4xl font-normal leading-none tracking-[-0.03em] text-primary sm:text-5xl">
              Kimlik Doğrulama Gerekli
            </h1>
            <p className="text-[16px] leading-[1.5] text-muted-foreground">
              Uygulama eylemlerini kullanmak için lütfen ikas üzerinden kimlik doğrulaması yapın.
            </p>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="text-foreground">
      <PageContainer>
        <PageHeader
          eyebrow="STOK YÖNETİMİ"
          title="Stok Takibi"
          actions={
            <Button onClick={() => downloadCSV(filters.displayedRows)} className="gap-2">
              <Download className="size-4" />
              CSV İndir
            </Button>
          }
        />

        {/* Filtre araçları kanvasta yüzer (rapor ile aynı dil); kart yalnız tablo */}
        <FilterBar
          query={filters.query}
          onQueryChange={filters.setQuery}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={filters.setStatusFilter}
          stockRange={filters.stockRange}
          onStockRangeChange={filters.setStockRange}
          sortBy={filters.sortBy}
          onSortByChange={filters.setSortBy}
        />
        <TableSection label="Ürün listesi">
          <ProductTable
            rows={filters.displayedRows}
            hasActiveFilters={filters.hasActiveFilters}
            onClearFilters={filters.clearAllFilters}
            onSelectProduct={setSelectedProductId}
            hasMore={filters.hasMore}
            onLoadMore={filters.loadMore}
            loadingMore={filters.loadingMore}
            sortBy={filters.sortBy}
            sortReversed={filters.sortReversed}
            onSortBy={filters.setSortBy}
            onToggleSortDirection={filters.toggleSortDirection}
          />
        </TableSection>
      </PageContainer>

      {/* Ürün detay modalı */}
      <ProductDetailModal
        product={selectedProduct}
        analytics={analytics}
        token={token}
        viewStats={viewStats}
        onClose={() => setSelectedProductId(null)}
        onVariantStockChange={onVariantStockChange}
      />
    </div>
  );
};

export default HomePage;
