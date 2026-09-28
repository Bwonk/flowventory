import { sendViaResend } from '@/lib/email/resend';

// Geriye dönük import yolu: hata sınıfı artık lib/email/resend'de yaşar.
export { EmailNotConfiguredError } from '@/lib/email/resend';

/**
 * Tedarikçiye satın alma siparişi e-postası (Resend).
 *
 * alerts/email.ts'ten farklı olarak RESEND_API_KEY yoksa sessizce atlamaz —
 * kullanıcı bilinçli olarak "Gönder"e bastı, hata görünür olmalı (route 503'e
 * çevirir). Dev notu: RESEND_FROM doğrulanmış bir domain değilse
 * (onboarding@resend.dev), Resend yalnızca hesap sahibinin adresine teslim
 * eder; gerçek tedarikçi gönderimi doğrulanmış domain ister.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PurchaseOrderEmailInput {
  label: string;
  vendorName: string;
  storeName: string | null;
  expectedAt: Date | null;
  lines: Array<{ productName: string; variantName: string | null; sku: string | null; qty: number; unitCost: number | null }>;
}

/**
 * Numaralı satın alma siparişi e-postası. Alış fiyatı bilinmeyen satır
 * fiyatsız gider — satış fiyatı tedarikçiye asla gösterilmez. Yanıt adresi
 * mağazanın bildirim e-postasıdır (varsa).
 */
export async function sendPurchaseOrderEmail(
  to: string,
  order: PurchaseOrderEmailInput,
  options: { currencyCode: string; replyTo: string | null },
): Promise<void> {
  const price = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: options.currencyCode });
  const showPrices = order.lines.some(l => l.unitCost !== null);
  const total = order.lines.reduce((s, l) => s + (l.unitCost ?? 0) * l.qty, 0);
  const hasUnknown = order.lines.some(l => l.unitCost === null);

  const cell = 'padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#212121';
  const cellRight = `${cell};text-align:right;white-space:nowrap`;
  const header = 'padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#93939f;text-align:left';

  const rows = order.lines
    .map(line => {
      const name = escapeHtml(line.productName) + (line.variantName ? ` <span style="color:#616161">${escapeHtml(line.variantName)}</span>` : '');
      const priceCells = showPrices
        ? `<td style="${cellRight}">${line.unitCost === null ? '—' : price.format(line.unitCost)}</td>
        <td style="${cellRight};font-weight:600">${line.unitCost === null ? '—' : price.format(line.unitCost * line.qty)}</td>`
        : '';
      return `<tr>
        <td style="${cell}">${name}</td>
        <td style="${cell};color:#616161;white-space:nowrap">${line.sku ? escapeHtml(line.sku) : '—'}</td>
        <td style="${cellRight}">${line.qty}</td>
        ${priceCells}
      </tr>`;
    })
    .join('');

  const from = order.storeName ? escapeHtml(order.storeName) : 'Mağazamız';
  const expected = order.expectedAt
    ? `<p style="font-size:13px;color:#212121;margin:0 0 16px">Beklenen teslim: <strong>${order.expectedAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>`
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px">
      <p style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#93939f;margin:0 0 4px">${from} · ${escapeHtml(order.label)}</p>
      <h1 style="font-size:20px;font-weight:600;color:#17171c;margin:0 0 8px">Satın alma siparişi — ${escapeHtml(order.vendorName)}</h1>
      ${expected}
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px">
        <tr>
          <th style="${header}">Ürün</th>
          <th style="${header}">SKU</th>
          <th style="${header};text-align:right">Adet</th>
          ${showPrices ? `<th style="${header};text-align:right">Birim</th><th style="${header};text-align:right">Tutar</th>` : ''}
        </tr>
        ${rows}
        ${
          showPrices
            ? `<tr>
          <td colspan="4" style="padding:8px 12px;font-size:13px;font-weight:600;color:#17171c;text-align:right">Toplam${hasUnknown ? ' (fiyatlı satırlar)' : ''}</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#17171c;text-align:right;white-space:nowrap">${price.format(total)}</td>
        </tr>`
            : ''
        }
      </table>
      <p style="font-size:12px;color:#93939f;margin-top:16px">Sorularınız için bu e-postayı yanıtlayabilirsiniz. Sipariş numarası: ${escapeHtml(order.label)}.</p>
    </div>`;

  await sendViaResend({
    to,
    subject: `${order.label} · Satın alma siparişi — ${order.storeName ?? order.vendorName} (${order.lines.length} kalem)`,
    html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });
}
