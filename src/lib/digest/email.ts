import { Resend } from 'resend';
import { formatDateKey, formatMoneyRounded, formatNumber } from '@/lib/format';
import { EmailNotConfiguredError } from '@/lib/vendors/purchase-email';
import type { DigestContent } from './compute';

/**
 * Özet raporu e-postası (Resend). Şablon saf `renderDigestEmail`'de — test
 * edilebilir; gönderim `sendDigestEmail`'de. RESEND_API_KEY yoksa
 * EmailNotConfiguredError fırlatır (cron turu tümden atlar, test gönderimi 503).
 */

const FREQUENCY_LABELS = { daily: 'Günlük', weekly: 'Haftalık' } as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function digestRangeLabel(content: DigestContent): string {
  const { start, end } = content.ranges.current;
  const endLabel = formatDateKey(end) ?? end;
  return start === end ? endLabel : `${formatDateKey(start) ?? start} – ${endLabel}`;
}

function deltaHtml(delta: number | null): string {
  if (delta === null) return '<span style="color:#93939f">önceki dönem verisi yok</span>';
  const color = delta > 0 ? '#15803d' : delta < 0 ? '#b91c1c' : '#616161';
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `<span style="color:${color}">${sign}%${formatNumber(Math.abs(delta))}</span> <span style="color:#93939f">önceki döneme göre</span>`;
}

const S = {
  eyebrow: 'font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#93939f;margin:0 0 4px',
  h1: 'font-size:20px;font-weight:600;color:#17171c;margin:0 0 20px',
  h2: 'font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#93939f;margin:24px 0 8px',
  table: 'width:100%;border-collapse:collapse;border:1px solid #e5e7eb',
  cell: 'padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#212121',
  kpiCell: 'padding:12px;border:1px solid #e5e7eb;vertical-align:top;width:50%',
  kpiLabel: 'font-size:11px;color:#616161;margin:0 0 4px',
  kpiValue: 'font-size:18px;font-weight:600;color:#17171c;margin:0 0 4px',
  kpiNote: 'font-size:11px;margin:0',
  text: 'font-size:13px;color:#212121;margin:0 0 6px',
  muted: 'font-size:13px;color:#93939f;margin:0',
};

function kpi(label: string, value: string, note: string): string {
  return `<td style="${S.kpiCell}">
    <p style="${S.kpiLabel}">${label}</p>
    <p style="${S.kpiValue}">${value}</p>
    <p style="${S.kpiNote}">${note}</p>
  </td>`;
}

export function renderDigestEmail(
  content: DigestContent,
  currencyCode: string,
): { subject: string; html: string } {
  const money = (n: number) => formatMoneyRounded(n, currencyCode);
  const frequencyLabel = FREQUENCY_LABELS[content.frequency];
  const rangeLabel = digestRangeLabel(content);
  const { sales, stock, deadStock, purchase } = content;

  const kpis = `<table style="${S.table}"><tr>
      ${kpi('Ciro', money(sales.revenue), deltaHtml(sales.revenueDelta))}
      ${kpi('Satış adedi', formatNumber(sales.units), deltaHtml(sales.unitsDelta))}
    </tr><tr>
      ${kpi('Tükenen ürün', formatNumber(stock.outOfStockCount), `<span style="color:#93939f">${formatNumber(stock.productCount)} üründen</span>`)}
      ${kpi('Az kalan ürün', formatNumber(stock.lowStockCount), `<span style="color:#93939f">eşik: ${formatNumber(stock.warningThreshold)} adet</span>`)}
    </tr></table>`;

  const topProducts =
    content.topProducts.length > 0
      ? `<table style="${S.table}">${content.topProducts
          .map(
            p => `<tr>
              <td style="${S.cell}">${escapeHtml(p.productName)}</td>
              <td style="${S.cell};text-align:right;white-space:nowrap;color:#616161">${formatNumber(p.units)} adet</td>
              <td style="${S.cell};text-align:right;white-space:nowrap;font-weight:600">${money(p.revenue)}</td>
            </tr>`,
          )
          .join('')}</table>`
      : `<p style="${S.muted}">Bu dönemde satış yok.</p>`;

  const lowest =
    stock.lowest.length > 0
      ? `<table style="${S.table}">${stock.lowest
          .map(
            p => `<tr>
              <td style="${S.cell}">${escapeHtml(p.productName)}</td>
              <td style="${S.cell};text-align:right;white-space:nowrap;${p.minStock === 0 ? 'color:#b91c1c;font-weight:600' : ''}">${
                p.minStock === 0 ? 'Tükendi' : `${formatNumber(p.minStock)} adet`
              }</td>
            </tr>`,
          )
          .join('')}</table>`
      : `<p style="${S.muted}">Eşiğin altında ürün yok.</p>`;

  const purchaseText =
    purchase.lineCount > 0
      ? `<p style="${S.text}"><strong>${formatNumber(purchase.lineCount)} kalem</strong> sipariş önerisi, toplam ${
          purchase.hasEstimate ? '~' : ''
        }${money(purchase.totalCost)}${
          purchase.urgentCount > 0
            ? ` — <span style="color:#b91c1c;font-weight:600">${formatNumber(purchase.urgentCount)} acil</span>`
            : ''
        }.</p><p style="${S.muted}">Ayrıntılar Flowventory → Satın Alma Raporu'nda.</p>`
      : `<p style="${S.muted}">Şu an sipariş önerisi yok.</p>`;

  const deadText =
    deadStock.count > 0
      ? `<p style="${S.text}"><strong>${formatNumber(deadStock.count)} ürün</strong> 30 gündür satılmıyor ya da 180+ günlük stoğu var — bağlı sermaye ${
          deadStock.isEstimate ? '~' : ''
        }${money(deadStock.lockedCapital)}.</p>${
          deadStock.isEstimate
            ? `<p style="${S.muted}">~ Alış fiyatı girilmemiş ürünlerde satış fiyatı kullanıldı.</p>`
            : ''
        }`
      : `<p style="${S.muted}">Ölü stok yok.</p>`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <p style="${S.eyebrow}">FLOWVENTORY · ${frequencyLabel.toUpperCase()} ÖZET</p>
      <h1 style="${S.h1}">${rangeLabel}</h1>
      ${kpis}
      <p style="${S.h2}">En çok satanlar</p>
      ${topProducts}
      <p style="${S.h2}">Stoğu azalanlar</p>
      ${lowest}
      <p style="${S.h2}">Satın alma</p>
      ${purchaseText}
      <p style="${S.h2}">Ölü stok</p>
      ${deadText}
      <p style="font-size:12px;color:#93939f;margin-top:24px">
        Bu özet, Flowventory Ayarlar sayfasında ${frequencyLabel.toLocaleLowerCase('tr')} özet açık olduğu için gönderildi.
        Aynı yerden sıklığını değiştirebilir ya da kapatabilirsiniz.
      </p>
    </div>`;

  return {
    subject: `Flowventory ${frequencyLabel.toLocaleLowerCase('tr')} özet · ${rangeLabel}`,
    html,
  };
}

export async function sendDigestEmail(to: string, email: { subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();
  const from = process.env.RESEND_FROM || 'Flowventory <onboarding@resend.dev>';

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject: email.subject, html: email.html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
