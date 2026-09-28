import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';

/** Açılan sekmedeki blob adresi bu kadar süre geçerli kalır. */
const REVOKE_MS = 5 * 60 * 1000;

/**
 * Tıklama anında boş sekme açar — açılır pencere engelleyicisi await sonrası
 * açılan sekmeyi yakalar. Tarayıcı izin vermezse null (sonra toast'tan açılır).
 */
export function reservePdfWindow(): Window | null {
  return window.open('about:blank', '_blank');
}

/**
 * Siparişin tedarikçi belgesini (sunucuda çizilen A4 PDF) yeni sekmede açar;
 * tarayıcının PDF görüntüleyicisinden indirilir/yazdırılır. E-posta ekiyle
 * aynı dosya. `target` tıklama anında ayrılan sekmedir.
 */
export async function openOrderPdf(token: string, orderId: string, label: string | null, target: Window | null): Promise<void> {
  try {
    const res = await ApiRequests.purchaseOrders.pdf(token, orderId);
    const url = URL.createObjectURL(res.data);
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
    if (target && !target.closed) {
      target.location.href = url;
      return;
    }
    toast(`${label ?? 'Sipariş'} belgesi hazır`, {
      action: { label: "PDF'i aç", onClick: () => window.open(url, '_blank') },
      duration: 10_000,
    });
  } catch (error) {
    target?.close();
    logger.error('Purchase order PDF open failed', { orderId, error });
    toast.error('PDF oluşturulamadı. Yolda çekmecesinden yeniden deneyebilirsin.');
  }
}
