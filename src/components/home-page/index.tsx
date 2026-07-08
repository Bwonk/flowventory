import React from 'react';
import { ListProductsApiResponse } from '@/app/api/ikas/list-products/route';

type Product = NonNullable<ListProductsApiResponse['products']>[0];

interface HomePageProps {
  token: string | null;
  storeName?: string;
  products: Product[];
  loading: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ token, storeName, products = [], loading }) => {
  if (!token) {
    return (
      <div className="max-w-[1200px] mx-auto p-6 bg-background min-h-[100vh]">
        <div className="text-center p-20 bg-muted rounded-xl border border-dashed">
          <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
          <p className="text-muted-foreground">Please authenticate to use app actions.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto p-6 bg-background min-h-[100vh]">
        <div className="text-center p-20">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-6 bg-background min-h-[100vh]">

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Flowventory</h1>
        <p className="text-muted-foreground text-sm mt-1">{storeName}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Toplam Ürün</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Kritik</p>
          <p className="text-2xl font-bold text-red-500">
            {products.filter(p =>
              p.variants.some(v => (v.stocks?.[0]?.stockCount ?? 0) <= 3)
            ).length}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Dikkat</p>
          <p className="text-2xl font-bold text-yellow-500">
            {products.filter(p =>
              p.variants.some(v => {
                const stock = v.stocks?.[0]?.stockCount ?? 0;
                return stock > 3 && stock <= 10;
              })
            ).length}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Sağlıklı</p>
          <p className="text-2xl font-bold text-green-500">
            {products.filter(p =>
              p.variants.every(v => (v.stocks?.[0]?.stockCount ?? 0) > 10)
            ).length}
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-medium">Ürünler</h2>
        </div>
        <div className="divide-y">
          {products.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Henüz ürün bulunamadı.
            </div>
          ) : (
            products.map(product => (
              <div key={product.id} className="p-4">
                <p className="font-medium mb-2">{product.name}</p>
                <div className="space-y-1">
                  {product.variants.map((variant, index) => {
                    const stock = variant.stocks?.[0]?.stockCount ?? 0;
                    const color = stock <= 3 ? 'text-red-500' : stock <= 10 ? 'text-yellow-500' : 'text-green-500';
                    const dot = stock <= 3 ? '🔴' : stock <= 10 ? '🟡' : '🟢';
                    const variantLabel = variant.variantValues && variant.variantValues.length > 0
                      ? variant.variantValues.map(v => v.variantValueName).join(' / ')
                      : variant.sku || `Varyant ${index + 1}`;
                    return (
                      <div key={variant.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{variantLabel}</span>
                        <span className={`font-medium ${color}`}>{dot} {stock} adet</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default HomePage;