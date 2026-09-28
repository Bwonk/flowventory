import type { PurchaseOrderItem } from '@/lib/purchase-orders/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Siparişi tedarikçiye verilecek belge olarak yazdırır (tarayıcının "PDF olarak
 * kaydet"i). Sayfanın print CSS'ine dokunmamak için gizli bir iframe'de ayrı
 * belge açılır. Alış fiyatı bilinmeyen satır fiyatsız basılır.
 */
export function printOrder(order: PurchaseOrderItem, currencyCode: string): void {
  const price = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currencyCode });
  const showPrices = order.lines.some(l => l.unitCost !== null);
  const rows = order.lines
    .map(
      l => `<tr>
        <td>${escapeHtml(l.productName)}${l.variantName ? `<br><small>${escapeHtml(l.variantName)}</small>` : ''}</td>
        <td>${l.sku ? escapeHtml(l.sku) : '—'}</td>
        <td class="r">${l.qty}</td>
        ${showPrices ? `<td class="r">${l.unitCost === null ? '—' : price.format(l.unitCost)}</td><td class="r">${l.unitCost === null ? '—' : price.format(l.unitCost * l.qty)}</td>` : ''}
      </tr>`,
    )
    .join('');
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(order.label ?? 'Sipariş')}</title>
<style>
  body{font-family:-apple-system,"Segoe UI",Arial,sans-serif;color:#18181b;margin:32px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px} .muted{color:#71717a} .meta{display:flex;gap:32px;margin:12px 0 20px}
  table{width:100%;border-collapse:collapse} th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a;text-align:left}
  th,td{padding:7px 8px;border-bottom:1px solid #e4e4e7;vertical-align:top} .r{text-align:right;white-space:nowrap} small{color:#71717a}
</style></head><body>
  <p class="muted">${escapeHtml(order.label ?? '')}</p>
  <h1>Satın alma siparişi — ${escapeHtml(order.vendorName)}</h1>
  <div class="meta"><div><span class="muted">Sipariş tarihi</span><br>${date(order.sentAt)}</div><div><span class="muted">Beklenen teslim</span><br>${date(order.expectedAt)}</div><div><span class="muted">Kalem</span><br>${order.lines.length}</div></div>
  <table><thead><tr><th>Ürün</th><th>SKU</th><th class="r">Adet</th>${showPrices ? '<th class="r">Birim</th><th class="r">Tutar</th>' : ''}</tr></thead>
  <tbody>${rows}</tbody></table>
  ${showPrices ? `<p class="r" style="margin-top:12px"><strong>Toplam ${price.format(order.totalCost)}</strong>${order.hasUnknownCost ? ' <span class="muted">(fiyatı bilinen satırlar)</span>' : ''}</p>` : ''}
</body></html>`;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('afterprint', cleanup, { once: true });
  // Belge çizilsin, sonra yazdır.
  setTimeout(() => {
    win.focus();
    win.print();
    // Bazı tarayıcılar afterprint'i iframe'de tetiklemez.
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  }, 50);
}
