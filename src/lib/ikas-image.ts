/**
 * ikas ürün görseli CDN yardımcıları.
 * Format @ikas/app-helpers `getImageSrc` ile aynıdır:
 *   https://cdn.myikas.com/images/{merchantId}/{imageId}/image_{size}.webp
 */
export function buildImageUrl(merchantId: string, imageId: string, size = 360): string {
  return `https://cdn.myikas.com/images/${merchantId}/${imageId}/image_${size}.webp`;
}

type VariantImage = {
  imageId?: string | null;
  isMain: boolean;
  order: number;
  isVideo?: boolean | null;
};

/**
 * Varyantın ana görselini seçer: isMain işaretli (video olmayan) görsel;
 * yoksa order'a göre ilk video olmayan görsel.
 */
export function pickMainImageUrl(
  merchantId: string,
  images: VariantImage[] | null | undefined,
  size = 360,
): string | undefined {
  const list = images ?? [];
  const main =
    list.find(img => img.isMain && !img.isVideo) ??
    list
      .filter(img => !img.isVideo && img.imageId)
      .sort((a, b) => a.order - b.order)[0];
  return main?.imageId ? buildImageUrl(merchantId, main.imageId, size) : undefined;
}
