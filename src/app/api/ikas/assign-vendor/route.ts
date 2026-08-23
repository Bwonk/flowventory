import { logger } from '@/lib/logger';
import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Tekil productId (eski istemciler) veya productIds dizisi kabul edilir.
const assignVendorSchema = z
  .object({
    productId: z.string().min(1).optional(),
    productIds: z.array(z.string().min(1)).min(1).max(50).optional(),
    vendorName: z.string().trim().min(1).max(150),
  })
  .refine(body => body.productId || body.productIds?.length, {
    message: 'productId veya productIds gerekli',
  });

export type AssignVendorApiResponse = {
  vendorId: string;
  vendorName: string;
  /** Başarıyla atanan ürün id'leri. */
  assigned: string[];
  /** Atanamayan ürün id'leri (mutation hatası). */
  failed: string[];
};

/**
 * POST /api/ikas/assign-vendor
 *
 * Ürün(lere) isimle tedarikçi atar. ikas'ta bağımsız vendor CRUD'u yok;
 * updateProduct(input: { id, vendor: { name } }) aynı isimli tedarikçiyi
 * bulur ya da oluşturur (aynı isim → aynı vendorId) — tedarikçi ikas
 * admin'de ilk atamayla var olur. Yalnız id+vendor göndermenin diğer ürün
 * alanlarını KORUDUĞU test mağazasında doğrulandı (2026-08-21, MCP execute
 * ile önce/sonra karşılaştırması).
 *
 * NOT (2026-08-22, canlı testle doğrulandı): `vendor: null` göndermek alanı
 * TEMİZLEMEZ — ikas null'u yok sayar (mutation yanıtı yanıltıcı biçimde
 * input'taki null'u yansıtır ama kayıt değişmez). Ürünü tedarikçiden çıkarmanın
 * API yolu yok; tek yol ikas admin arayüzünden alanı elle boşaltmak.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const parsed = assignVendorSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const { vendorName } = parsed.data;
    const productIds = Array.from(
      new Set(parsed.data.productIds ?? (parsed.data.productId ? [parsed.data.productId] : [])),
    );

    const ikasClient = getIkas(authToken);
    let vendorId: string | null = null;
    const assigned: string[] = [];
    const failed: string[] = [];

    for (const productId of productIds) {
      try {
        const response = await ikasClient.mutations.updateProduct({
          input: { id: productId, vendor: { name: vendorName } },
        });
        const vendor = response.data?.updateProduct?.vendor;
        if (!response.isSuccess || !vendor) {
          failed.push(productId);
          continue;
        }
        vendorId = vendor.id;
        assigned.push(productId);

        // Yerel snapshot'ı hemen tazele — rapor refetch'i yeni grubu görsün.
        await refreshProductSnapshot(user.merchantId, authToken, productId).catch(error => {
          logger.warn('Snapshot refresh after vendor assign failed', { productId, error });
        });
      } catch (error) {
        logger.warn('Vendor assign failed for product', { productId, error });
        failed.push(productId);
      }
    }

    if (vendorId === null) {
      return NextResponse.json({ error: 'Tedarikçi atanamadı' }, { status: 502 });
    }

    const data: AssignVendorApiResponse = { vendorId, vendorName, assigned, failed };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Assign vendor error', { error });
    return NextResponse.json({ error: 'Tedarikçi atanamadı' }, { status: 500 });
  }
}
