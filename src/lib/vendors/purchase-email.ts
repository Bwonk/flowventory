import { sendViaResend } from '@/lib/email/resend';
import { purchaseOrderEmailSubject, renderPurchaseOrderEmail } from '@/lib/documents/purchase-order-email';
import { purchaseOrderFileName, type PurchaseOrderDocument } from '@/lib/documents/purchase-order';

// Geriye dönük import yolu: hata sınıfı artık lib/email/resend'de yaşar.
export { EmailNotConfiguredError } from '@/lib/email/resend';

/**
 * Tedarikçiye satın alma siparişi e-postası (Resend) — gövde
 * `documents/purchase-order-email`, ek PDF `documents/purchase-order-pdf`.
 *
 * alerts/email.ts'ten farklı olarak RESEND_API_KEY yoksa sessizce atlamaz —
 * kullanıcı bilinçli olarak "Gönder"e bastı, hata görünür olmalı (route 503'e
 * çevirir). Yanıt adresi mağazanın bildirim e-postasıdır (varsa). PDF
 * üretilemezse (pdf=null) e-posta eksiz gider; sipariş satırları gövdede.
 */
export async function sendPurchaseOrderEmail(to: string, doc: PurchaseOrderDocument, pdf: Buffer | null): Promise<void> {
  await sendViaResend({
    to,
    subject: purchaseOrderEmailSubject(doc),
    html: renderPurchaseOrderEmail(doc, { hasAttachment: pdf !== null }),
    ...(doc.storeEmail ? { replyTo: doc.storeEmail } : {}),
    ...(pdf ? { attachments: [{ filename: purchaseOrderFileName(doc), content: pdf }] } : {}),
  });
}
