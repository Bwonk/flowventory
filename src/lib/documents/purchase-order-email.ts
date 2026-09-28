import { displayName, monogram } from './profile';
import { docMoney, docMoneyRounded, docShortDate, docDate, escapeHtml } from './format';
import type { PurchaseOrderDocument } from './purchase-order';

/**
 * Tedarikçiye giden sipariş e-postası — saf şablon (test edilebilir).
 * Resmî kopya ekteki PDF'tir; gövde özet + satırlar + tek çağrı ("yanıtla").
 * Tedarikçinin hesabı olmadığı için buton yok. E-posta istemcileri için
 * tablo düzeni ve satır içi stil; Geist yüklenmezse sistem fontuna düşer.
 */

const FONT = `Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const MONO = `'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
const INK = '#18181b';
const INK2 = '#3f3f46';
const MUTED = '#71717a';
const HAIRLINE = '#e4e4e7';
const WARN = '#b45309';

const eyebrow = (text: string) =>
  `<span style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.5px;color:${MUTED}">${escapeHtml(text.toLocaleUpperCase('tr-TR'))}</span>`;

export function purchaseOrderEmailSubject(doc: PurchaseOrderDocument): string {
  return `${doc.label} · ${displayName(doc.store)} satın alma siparişi (${doc.lines.length} kalem)`;
}

export function renderPurchaseOrderEmail(doc: PurchaseOrderDocument, options: { hasAttachment: boolean }): string {
  const name = displayName(doc.store);
  const money = (n: number) => docMoney(n, doc.currencyCode);
  const deliverBy = doc.expectedAt ? docDate(doc.expectedAt, doc.timeZone).replace(/ \d{4}$/, '') : null;
  const intro = deliverBy
    ? `Aşağıdaki ürünleri ${escapeHtml(deliverBy)} tarihine kadar teslim etmenizi rica ederiz.`
    : 'Aşağıdaki ürünler için teslim tarihini yanıtınızda bildirmenizi rica ederiz.';

  const summary = [
    ['Kalem', `${doc.lines.length} · ${doc.totalQty.toLocaleString('tr-TR')} adet`],
    ['Toplam', docMoneyRounded(doc.subtotal, doc.currencyCode)],
    ['Teslim', doc.expectedAt ? docShortDate(doc.expectedAt, doc.timeZone) : '—'],
  ]
    .map(
      ([label, value], i) => `<td style="padding:14px ${i === 2 ? 28 : 16}px 14px ${i === 0 ? 28 : 16}px;${i > 0 ? `border-left:1px solid ${HAIRLINE};` : ''}vertical-align:top">
        ${eyebrow(label)}<br>
        <span style="font-family:${MONO};font-size:15px;font-weight:500;color:${INK};white-space:nowrap">${escapeHtml(value)}</span>
      </td>`,
    )
    .join('');

  const rows = doc.lines
    .map((l, i) => {
      const border = i < doc.lines.length - 1 ? `border-bottom:1px solid ${HAIRLINE};` : '';
      const variant = l.variantName ? ` <span style="color:${MUTED}">· ${escapeHtml(l.variantName)}</span>` : '';
      const sku = l.sku ? `<br><span style="font-family:${MONO};font-size:11px;color:${MUTED}">${escapeHtml(l.sku)}</span>` : '';
      const total =
        l.lineTotal === null
          ? `<span style="color:${WARN}">Teyit edin</span>`
          : escapeHtml(money(l.lineTotal));
      return `<tr>
        <td style="padding:10px 0;${border}font-size:13px;color:${INK};vertical-align:top">${escapeHtml(l.productName)}${variant}${sku}</td>
        <td style="padding:10px 0 10px 16px;${border}font-size:13px;font-weight:600;color:${INK};text-align:right;white-space:nowrap;vertical-align:top">${l.qty.toLocaleString('tr-TR')}</td>
        <td style="padding:10px 0 10px 16px;${border}font-size:13px;color:${INK};text-align:right;white-space:nowrap;vertical-align:top">${total}</td>
      </tr>`;
    })
    .join('');

  const askParts = [
    doc.unpricedCount > 0 ? `Stokta olmayan kalemleri ve fiyatı yazılmayan ${doc.unpricedCount} kalemin birim fiyatını yanıtınıza ekleyin.` : 'Stokta olmayan kalem varsa yanıtınıza ekleyin.',
    `İrsaliyede ${escapeHtml(doc.label)} numarasını belirtin.`,
  ];
  const contact = [escapeHtml(name), doc.storeEmail ? escapeHtml(doc.storeEmail) : null, doc.store.phone ? escapeHtml(doc.store.phone) : null]
    .filter(Boolean)
    .join(' · ');

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(doc.label)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">
<tr><td align="center" style="padding:28px 12px 32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:8px;font-family:${FONT};color:${INK}">
    <tr><td style="padding:24px 28px 0">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:28px;height:28px;background:${INK};border-radius:6px;color:#ffffff;font-size:13px;font-weight:600;text-align:center;line-height:28px">${escapeHtml(monogram(name))}</td>
        <td style="padding-left:10px;font-size:14px;font-weight:600;color:${INK}">${escapeHtml(name)}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:20px 28px 24px">
      ${eyebrow(`Satın alma siparişi · ${doc.label}`)}
      <h1 style="margin:6px 0 6px;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-0.3px;color:${INK}">Yeni siparişimiz${options.hasAttachment ? ' ekte' : ' aşağıda'}.</h1>
      <p style="margin:0;font-size:14px;line-height:1.5;color:${INK2}">${intro}</p>
    </td></tr>
    <tr><td style="border-top:1px solid ${HAIRLINE};border-bottom:1px solid ${HAIRLINE}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${summary}</tr></table>
    </td></tr>
    <tr><td style="padding:8px 28px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>
    <tr><td style="padding:0 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1.5px solid ${INK}"><tr>
        <td style="padding:12px 0;font-size:13px;font-weight:600;color:${INK}">Toplam${doc.unpricedCount > 0 ? ' <span style="font-weight:400;color:' + MUTED + '">(fiyatlı kalemler)</span>' : ''}</td>
        <td style="padding:12px 0;font-size:13px;font-weight:600;color:${INK};text-align:right;white-space:nowrap">${escapeHtml(money(doc.subtotal))}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 28px 24px">
      <div style="background:#f4f4f5;border-radius:6px;padding:14px 16px;font-size:13px;line-height:1.5;color:${INK2}">
        <strong style="color:${INK}">Teyit için bu e-postayı yanıtlayın.</strong> ${askParts.join(' ')}
      </div>
    </td></tr>
    <tr><td style="padding:16px 28px 22px;border-top:1px solid ${HAIRLINE};font-size:12px;line-height:1.6;color:${MUTED}">
      ${contact}<br>Bu sipariş Flowventory ile hazırlandı.${options.hasAttachment ? ' Resmî kopya ekteki PDF’tir.' : ''}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}
