import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ikas ürün görselinin CDN URL'sini üretir.
 * Format @ikas/app-helpers `getImageSrc` ile aynıdır:
 *   https://cdn.myikas.com/images/{merchantId}/{imageId}/image_{size}.webp
 */
function buildImageUrl(merchantId: string, imageId: string, size = 360): string {
  return `https://cdn.myikas.com/images/${merchantId}/${imageId}/image_${size}.webp`;
}

export type ListProductsApiResponse = {
  products?: Array<{
    id: string;
    name: string;
    categories?: Array<{ id: string; name: string }>;
    variants: Array<{
      id: string;
      sku: string | null;
      /** Hazır ikas CDN görsel URL'si (merchantId + imageId'den üretilir). */
      imageUrl?: string;
      images?: Array<{
        imageId?: string;
        fileName?: string;
        isMain: boolean;
        order: number;
        isVideo?: boolean;
      }>;
      variantValues: Array<{
        variantTypeName: string | null;
        variantValueName: string | null;
      }> | null;
      stocks: Array<{ stockCount: number; stockLocationId: string }> | null;
      prices: Array<{ sellPrice: number }>;
    }>;
  }>;
};

/**
 * GET /api/ikas/list-products
 *
 * Tüm ürünleri ve varyantlarını ikas'tan çeker.
 * Her varyant için stok sayısı ve fiyat bilgisi döner.
 *
 * Akış:
 * 1. JWT token'dan kullanıcıyı doğrula
 * 2. Veritabanından ikas auth token'ını al
 * 3. ikas GraphQL API'ye listProduct sorgusu at
 * 4. Veriyi frontend'e döndür
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Kullanıcı kimliğini doğrula
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Veritabanından ikas token'ını al
    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });
    }

    // 3. ikas GraphQL client'ını başlat ve sorguyu çalıştır
    const ikasClient = getIkas(authToken);
    const productResponse = await ikasClient.queries.listProduct();

    // 4. Veriyi kontrol et, görsel URL'lerini üret ve döndür
    if (productResponse.isSuccess && productResponse.data?.listProduct) {
      const rawProducts = productResponse.data.listProduct.data;
      const products = rawProducts.map(product => ({
        ...product,
        variants: product.variants.map(variant => {
          const images = variant.images ?? [];
          // Ana görsel; yoksa videonun olmadığı ilk görsel (order'a göre).
          const main =
            images.find(img => img.isMain && !img.isVideo) ??
            images
              .filter(img => !img.isVideo && img.imageId)
              .sort((a, b) => a.order - b.order)[0];
          const imageUrl =
            main?.imageId ? buildImageUrl(user.merchantId, main.imageId) : undefined;
          return { ...variant, imageUrl };
        }),
      }));
      return NextResponse.json({ data: { products } });
    } else {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}