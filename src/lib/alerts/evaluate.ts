import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz } from '@/lib/timezone';
import { sendAlertEmail } from './email';
import {
  evaluateCriticalStock,
  evaluateDeadStock,
  evaluateSalesSpike,
  type AlertCandidate,
  type ProductStockState,
} from './rules';

const WINDOW_DAYS = 30;

/**
 * Sync sonrası alarm değerlendirmesi.
 *
 * Snapshot + SalesDaily üzerinden kuralları çalıştırır, yeni bildirimleri
 * Notification tablosuna yazar (dedupeKey ile idempotent) ve e-posta
 * bildirimi açıksa özet e-posta gönderir. Hatalar sync'i kırmaz.
 */
export async function evaluateAlerts(merchantId: string): Promise<number> {
  try {
    const settings = await getMerchantSettings(merchantId);
    const { timezone, criticalThreshold } = settings;

    const now = new Date();
    const dayKey = dateKeyInTz(now, timezone);
    // Hafta anahtarı: haftanın ilk gününün tarihi (7 günde bir tekrar bildirim).
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekKey = `w-${dateKeyInTz(weekStart, timezone)}`;

    const windowStart = new Date(now);
    windowStart.setDate(now.getDate() - WINDOW_DAYS);
    const windowStartKey = dateKeyInTz(windowStart, timezone);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDayKey = dateKeyInTz(sevenDaysAgo, timezone);

    const [snapshots, salesRows] = await Promise.all([
      prisma.productSnapshot.findMany({ where: { merchantId } }),
      prisma.salesDaily.findMany({ where: { merchantId, date: { gte: windowStartKey } } }),
    ]);

    if (snapshots.length === 0) return 0;

    // Ürün bazlı stok durumu
    const products = new Map<string, ProductStockState>();
    const variantToProduct = new Map<string, string>();
    for (const snap of snapshots) {
      variantToProduct.set(snap.variantId, snap.productId);
      const p = products.get(snap.productId) ?? {
        productId: snap.productId,
        productName: snap.productName,
        minStock: Number.POSITIVE_INFINITY,
        totalStock: 0,
        soldQtyWindow: 0,
      };
      p.minStock = Math.min(p.minStock, snap.totalStock);
      p.totalStock += snap.totalStock;
      products.set(snap.productId, p);
    }

    // Satışları ürün × gün olarak topla
    const qtyByProductDay = new Map<string, Map<string, number>>();
    for (const row of salesRows) {
      const productId = variantToProduct.get(row.variantId);
      if (!productId) continue;
      const product = products.get(productId);
      if (product) product.soldQtyWindow += row.quantity;
      const byDay = qtyByProductDay.get(productId) ?? new Map<string, number>();
      byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.quantity);
      qtyByProductDay.set(productId, byDay);
    }

    // Kuralları çalıştır
    const candidates: AlertCandidate[] = [];
    for (const product of products.values()) {
      if (!Number.isFinite(product.minStock)) product.minStock = 0;

      const critical = evaluateCriticalStock(product, criticalThreshold, dayKey);
      if (critical) candidates.push(critical);

      const dead = evaluateDeadStock(product, weekKey);
      if (dead) candidates.push(dead);

      const byDay = qtyByProductDay.get(product.productId);
      if (byDay) {
        const todayQty = byDay.get(dayKey) ?? 0;
        const prev7 = Array.from(byDay.entries())
          .filter(([date]) => date >= sevenDayKey && date < dayKey)
          .map(([, qty]) => qty);
        const spike = evaluateSalesSpike(
          { productId: product.productId, productName: product.productName },
          todayQty,
          prev7,
          dayKey,
        );
        if (spike) candidates.push(spike);
      }
    }

    // Dedupe: daha önce bildirilmişleri ele (unique kısıt yarışı da tolere edilir).
    const created: AlertCandidate[] = [];
    for (const candidate of candidates) {
      try {
        await prisma.notification.create({
          data: {
            merchantId,
            type: candidate.type,
            title: candidate.title,
            body: candidate.body,
            productId: candidate.productId,
            dedupeKey: candidate.dedupeKey,
          },
        });
        created.push(candidate);
      } catch {
        // Unique ihlali → bu periyotta zaten bildirildi.
      }
    }

    if (created.length > 0) {
      logger.info('Alerts created', { merchantId, count: created.length });
      if (settings.emailNotifications && settings.notificationEmail) {
        await sendAlertEmail(settings.notificationEmail, created).catch(error => {
          logger.error('Alert email failed', { merchantId, error });
        });
      }
    }

    return created.length;
  } catch (error) {
    logger.error('Alert evaluation failed', { merchantId, error });
    return 0;
  }
}
