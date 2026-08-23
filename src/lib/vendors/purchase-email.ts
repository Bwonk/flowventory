import { Resend } from 'resend';
import type { PurchaseReportVendor } from '@/lib/reports/purchase-report';

/**
 * Tedarikçiye satın alma siparişi e-postası (Resend).
 *
 * alerts/email.ts'ten farklı olarak RESEND_API_KEY yoksa sessizce atlamaz —
 * kullanıcı bilinçli olarak "Gönder"e bastı, hata görünür olmalı (route 503'e
 * çevirir). Dev notu: RESEND_FROM doğrulanmış bir domain değilse
 * (onboarding@resend.dev), Resend yalnızca hesap sahibinin adresine teslim
 * eder; gerçek tedarikçi gönderimi doğrulanmış domain ister.
 */

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('RESEND_API_KEY is not set');
    this.name = 'EmailNotConfiguredError';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendVendorOrderEmail(
  to: string,
  vendor: PurchaseReportVendor,
  currencyCode: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();
  const from = process.env.RESEND_FROM || 'Flowventory <onboarding@resend.dev>';

  const price = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currencyCode });

  const cell = 'padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#212121';
  const cellRight = `${cell};text-align:right;white-space:nowrap`;
  const rows = vendor.lines
    .map(line => {
      const name = escapeHtml(line.productName) + (line.variantName ? ` <span style="color:#616161">${escapeHtml(line.variantName)}</span>` : '');
      return `<tr>
        <td style="${cell}">${name}</td>
        <td style="${cell};color:#616161;white-space:nowrap">${line.sku ? escapeHtml(line.sku) : '—'}</td>
        <td style="${cellRight}">${line.suggestedQty}</td>
        <td style="${cellRight}">${price.format(line.unitCost)}</td>
        <td style="${cellRight};font-weight:600">${price.format(line.lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const header = 'padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#93939f;text-align:left';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px">
      <p style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#93939f;margin:0 0 4px">FLOWVENTORY</p>
      <h1 style="font-size:20px;font-weight:600;color:#17171c;margin:0 0 16px">Satın alma siparişi — ${escapeHtml(vendor.vendorName)}</h1>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px">
        <tr>
          <th style="${header}">Ürün</th>
          <th style="${header}">SKU</th>
          <th style="${header};text-align:right">Adet</th>
          <th style="${header};text-align:right">Birim</th>
          <th style="${header};text-align:right">Tutar</th>
        </tr>
        ${rows}
        <tr>
          <td colspan="4" style="padding:8px 12px;font-size:13px;font-weight:600;color:#17171c;text-align:right">Toplam</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#17171c;text-align:right;white-space:nowrap">${price.format(vendor.totalCost)}</td>
        </tr>
      </table>
      ${vendor.hasEstimate ? '<p style="font-size:12px;color:#93939f;margin-top:12px">Alış fiyatı tanımlı olmayan ürünlerde birim fiyat, satış fiyatından tahmini olarak alınmıştır.</p>' : ''}
      <p style="font-size:12px;color:#93939f;margin-top:16px">Bu sipariş listesi Flowventory ile oluşturuldu.</p>
    </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `Satın alma siparişi — ${vendor.vendorName} (${vendor.lines.length} kalem)`,
    html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
