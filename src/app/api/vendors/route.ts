import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export type VendorListItem = {
  vendorId: string;
  vendorName: string;
  email: string | null;
  phone: string | null;
};

export type VendorsApiResponse = {
  vendors: VendorListItem[];
};

/**
 * GET /api/vendors
 *
 * Mağazadaki tedarikçilerin tekil listesi + yerel iletişim bilgileri.
 * ikas'ta bağımsız vendor listeleme ucu yok; kaynak, sync'lenen
 * ProductSnapshot satırlarıdır (source of truth). İletişim bilgisi
 * VendorContact'tan LEFT JOIN edilir; öksüz contact'lar yok sayılır.
 */
/**
 * "Tedarikçi Ekle" ile açılan kayıtlar henüz hiçbir üründe olmadığından
 * ikas'ta karşılığı yoktur; `local-` önekli id ile yerelde yaşarlar.
 * Aynı isim bir ürüne atandığında ikas gerçek vendorId'yi verir ve kayıt
 * GET sırasında o id'ye taşınır (lazy reconcile).
 */
const LOCAL_VENDOR_PREFIX = 'local-';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [rows, contacts] = await Promise.all([
      prisma.productSnapshot.findMany({
        where: { merchantId: user.merchantId, vendorId: { not: null } },
        distinct: ['vendorId'],
        select: { vendorId: true, vendorName: true },
      }),
      prisma.vendorContact.findMany({ where: { merchantId: user.merchantId } }),
    ]);

    const snapshotVendors = rows.filter(
      (r): r is { vendorId: string; vendorName: string | null } => r.vendorId !== null,
    );
    const realIdByName = new Map(
      snapshotVendors.map(r => [(r.vendorName ?? '').toLocaleLowerCase('tr'), r.vendorId]),
    );

    // Lazy reconcile: ismen ikas'ta artık var olan yerel kayıtları gerçek id'ye taşı.
    const contactByVendor = new Map(contacts.map(c => [c.vendorId, c]));
    for (const contact of contacts) {
      if (!contact.vendorId.startsWith(LOCAL_VENDOR_PREFIX)) continue;
      const realId = realIdByName.get(contact.vendorName.toLocaleLowerCase('tr'));
      if (!realId) continue;
      if (contactByVendor.has(realId)) {
        // Gerçek id'de zaten kayıt var — yerel kopya gereksiz.
        await prisma.vendorContact.delete({ where: { id: contact.id } });
        contactByVendor.delete(contact.vendorId);
      } else {
        const moved = await prisma.vendorContact.update({
          where: { id: contact.id },
          data: { vendorId: realId },
        });
        contactByVendor.delete(contact.vendorId);
        contactByVendor.set(realId, moved);
      }
    }

    const fromSnapshots: VendorListItem[] = snapshotVendors.map(r => {
      const contact = contactByVendor.get(r.vendorId);
      return {
        vendorId: r.vendorId,
        vendorName: r.vendorName ?? r.vendorId,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
      };
    });

    const localOnly: VendorListItem[] = Array.from(contactByVendor.values())
      .filter(c => c.vendorId.startsWith(LOCAL_VENDOR_PREFIX))
      .map(c => ({ vendorId: c.vendorId, vendorName: c.vendorName, email: c.email, phone: c.phone }));

    const vendors = [...fromSnapshots, ...localOnly].sort((a, b) =>
      a.vendorName.localeCompare(b.vendorName, 'tr'),
    );

    const data: VendorsApiResponse = { vendors };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Vendor list error', { error });
    return NextResponse.json({ error: 'Tedarikçiler alınamadı' }, { status: 500 });
  }
}

const createVendorSchema = z.object({
  vendorName: z.string().trim().min(1, 'Tedarikçi adı gerekli').max(150),
  email: z.string().email('Geçerli bir e-posta girin').max(320).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
});

/**
 * POST /api/vendors
 *
 * Rapor sayfasındaki "Tedarikçi Ekle" akışı: tedarikçiyi yerel kayıt olarak
 * açar (ikas'ta ürünsüz tedarikçi yaratılamaz). Atama popover'ında hemen
 * listelenir; bir ürüne atanınca gerçek ikas id'sine taşınır (bkz. GET).
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = createVendorSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' },
        { status: 400 },
      );
    }
    const { vendorName, email, phone } = parsed.data;
    const loweredName = vendorName.toLocaleLowerCase('tr');

    const [snapshotRows, contacts] = await Promise.all([
      prisma.productSnapshot.findMany({
        where: { merchantId: user.merchantId, vendorId: { not: null } },
        distinct: ['vendorId'],
        select: { vendorName: true },
      }),
      prisma.vendorContact.findMany({ where: { merchantId: user.merchantId }, select: { vendorName: true } }),
    ]);

    const snapshotMatch = snapshotRows.some(r => (r.vendorName ?? '').toLocaleLowerCase('tr') === loweredName);
    const contactMatch = contacts.some(c => c.vendorName.toLocaleLowerCase('tr') === loweredName);
    if (snapshotMatch || contactMatch) {
      return NextResponse.json({ error: 'Bu isimde tedarikçi zaten var.' }, { status: 409 });
    }

    const created = await prisma.vendorContact.create({
      data: {
        merchantId: user.merchantId,
        vendorId: `${LOCAL_VENDOR_PREFIX}${crypto.randomUUID()}`,
        vendorName,
        email: email ?? null,
        phone: phone ?? null,
      },
    });

    const data: VendorListItem = {
      vendorId: created.vendorId,
      vendorName: created.vendorName,
      email: created.email,
      phone: created.phone,
    };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Vendor create error', { error });
    return NextResponse.json({ error: 'Tedarikçi eklenemedi' }, { status: 500 });
  }
}

const deleteVendorSchema = z.object({
  vendorId: z.string().min(1),
});

export type DeleteVendorApiResponse = {
  vendorId: string;
};

/**
 * DELETE /api/vendors
 *
 * Tedarikçiyi siler. ikas'ta vendor delete ucu yok; gerçek bir tedarikçi
 * snapshot'ta ürünü olduğu sürece listede yeniden belireceğinden, silme
 * yalnız ürünsüz tedarikçilerde (yeni local- kayıtlar ya da ürünleri
 * taşınmış olanlar) kabul edilir — aksi halde 409.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = deleteVendorSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const { vendorId } = parsed.data;

    const productCount = await prisma.productSnapshot.count({
      where: { merchantId: user.merchantId, vendorId },
    });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Bu tedarikçide ${productCount} ürün var. Önce ürünleri başka tedarikçiye taşıyın.` },
        { status: 409 },
      );
    }

    await prisma.vendorContact.deleteMany({
      where: { merchantId: user.merchantId, vendorId },
    });

    const data: DeleteVendorApiResponse = { vendorId };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Vendor delete error', { error });
    return NextResponse.json({ error: 'Tedarikçi silinemedi' }, { status: 500 });
  }
}

const contactSchema = z.object({
  vendorId: z.string().min(1),
  vendorName: z.string().trim().min(1).max(150),
  email: z.string().email('Geçerli bir e-posta girin').max(320).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
});

/**
 * PUT /api/vendors
 *
 * Tek tedarikçinin iletişim bilgilerini upsert eder (merchant-settings
 * deseninde). Boş string yerine null gönderilerek alan silinebilir.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = contactSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' },
        { status: 400 },
      );
    }
    const { vendorId, vendorName, email, phone } = parsed.data;

    const saved = await prisma.vendorContact.upsert({
      where: { merchantId_vendorId: { merchantId: user.merchantId, vendorId } },
      create: { merchantId: user.merchantId, vendorId, vendorName, email: email ?? null, phone: phone ?? null },
      update: { vendorName, email: email ?? null, phone: phone ?? null },
    });

    const data: VendorListItem = {
      vendorId: saved.vendorId,
      vendorName: saved.vendorName,
      email: saved.email,
      phone: saved.phone,
    };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Vendor contact upsert error', { error });
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }
}
