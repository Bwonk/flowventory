import { docDateTime, docMoney, docMoneyRounded, docNumber, escapeHtml } from './format';

/**
 * İç satın alma raporu — yazdırma belgesi (A4 yatay). Tedarikçiye gitmez:
 * stok, satış hızı, "kaç gün yeter" ve öneri burada. Saf HTML şablonu;
 * istemci gizli iframe'de yazdırır (`print-frame`).
 *
 * `@page { margin: 0 }` tarayıcının tarih/URL başlık-altlığını kaldırır;
 * sayfa boşluğu, her sayfada tekrarlanan thead/tfoot aralayıcılarıyla verilir.
 */

export type ReportPrintLine = {
  productName: string;
  variantName: string | null;
  sku: string | null;
  currentStock: number;
  dailyAvg: number;
  daysOfCover: number | null;
  incoming: number;
  rawQty: number;
  suggestedQty: number;
  needsOrder: boolean;
  urgent: boolean;
  /** Siparişe yazılan adet (tablodaki tik). */
  qty: number;
  unitCost: number;
  isEstimate: boolean;
};

export type ReportPrintVendor = {
  name: string;
  /** Tedarikçisiz grup (sipariş edilemez). */
  unassigned: boolean;
  leadTimeDays: number;
  lines: ReportPrintLine[];
};

export type ReportPrintInput = {
  storeName: string | null;
  generatedAt: string;
  timeZone: string;
  currencyCode: string;
  targetStockDays: number;
  salesWindowDays: number;
  vendors: ReportPrintVendor[];
  /** Kök adresi — Geist dosyaları `${fontBaseUrl}/fonts/…`. */
  fontBaseUrl: string;
};

const up = (text: string) => escapeHtml(text.toLocaleUpperCase('tr-TR'));

type Tone = 'crit' | 'warn' | 'none';

function coverTone(line: ReportPrintLine, leadTimeDays: number): Tone {
  if (line.daysOfCover === null) return 'none';
  if (line.urgent) return 'crit';
  if (line.daysOfCover < leadTimeDays * 2) return 'warn';
  return 'none';
}

/** Çubuk ölçeği: hedef stok günü (en az iki tedarik süresi) = %100. */
function coverCell(line: ReportPrintLine, leadTimeDays: number, targetDays: number): string {
  if (line.daysOfCover === null) return '<span class="dim">satış yok</span>';
  const scale = Math.max(targetDays, leadTimeDays * 2, 1);
  const width = Math.min(100, (line.daysOfCover / scale) * 100);
  const lead = Math.min(100, (leadTimeDays / scale) * 100);
  const tone = coverTone(line, leadTimeDays);
  const days = line.daysOfCover >= 999 ? '999+' : docNumber(Math.floor(line.daysOfCover));
  return `<div class="cover"><span class="d ${tone}">${days}</span><div class="bar"><i class="${tone}" style="width:${width.toFixed(1)}%"></i><u style="left:${lead.toFixed(1)}%"></u></div></div>`;
}

function lineTotal(line: ReportPrintLine): number {
  return line.qty * line.unitCost;
}

function vendorTable(vendor: ReportPrintVendor, input: ReportPrintInput): string {
  const money = (n: number) => docMoney(n, input.currencyCode);
  const total = vendor.lines.reduce((s, l) => s + lineTotal(l), 0);
  const estimate = vendor.lines.some(l => l.isEstimate);
  const rows = vendor.lines
    .map(l => {
      const suggestion = !l.needsOrder
        ? '<span class="dim">—</span>'
        : l.rawQty === l.suggestedQty
          ? docNumber(l.suggestedQty)
          : `${docNumber(Math.ceil(l.rawQty))} → ${docNumber(l.suggestedQty)}`;
      return `<tr>
        <td><span class="pn">${escapeHtml(l.productName)}</span>${l.variantName ? ` <span class="vr">${escapeHtml(l.variantName)}</span>` : ''}</td>
        <td class="code">${l.sku ? escapeHtml(l.sku) : '—'}</td>
        <td class="n">${docNumber(l.currentStock)}</td>
        <td class="n">${docNumber(l.dailyAvg, 1)}</td>
        <td class="n">${coverCell(l, vendor.leadTimeDays, input.targetStockDays)}</td>
        <td class="n">${l.incoming > 0 ? docNumber(l.incoming) : '<span class="dim">—</span>'}</td>
        <td class="n sug">${suggestion}</td>
        <td class="n ord">${docNumber(l.qty)}</td>
        <td class="n${l.isEstimate ? ' dim' : ''}">${l.isEstimate ? '~' : ''}${money(l.unitCost)}</td>
        <td class="n">${l.isEstimate ? '~' : ''}${money(lineTotal(l))}</td>
      </tr>`;
    })
    .join('');
  const meta = vendor.unassigned
    ? 'tedarikçi atanmamış'
    : `tedarik süresi ${vendor.leadTimeDays} gün · ${vendor.lines.length} kalem`;
  return `<section class="grp">
    <div class="grp-h"><div><b>${escapeHtml(vendor.name)}</b> <span>· ${meta}</span></div><span class="sub">${estimate ? '~' : ''}${money(total)}</span></div>
    <table class="rt">
      <colgroup><col><col style="width:13%"><col style="width:6%"><col style="width:7%"><col style="width:13%"><col style="width:6%"><col style="width:8%"><col style="width:6.5%"><col style="width:9%"><col style="width:10%"></colgroup>
      <thead><tr>
        <th>${up('Ürün')}</th><th>SKU</th><th class="n">STOK</th><th class="n">${up('Günlük satış')}</th><th class="n">${up('Kaç gün yeter')}</th><th class="n">YOLDA</th><th class="n">${up('Öneri')}</th><th class="n">${up('Sipariş')}</th><th class="n">BİRİM</th><th class="n">TUTAR</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export function renderPurchaseReportHtml(input: ReportPrintInput): string {
  const lines = input.vendors.flatMap(v => v.lines);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const estimateCount = lines.filter(l => l.isEstimate).length;
  const urgent = lines.filter(l => l.urgent).length;
  const incoming = lines.reduce((s, l) => s + l.incoming, 0);
  const vendorCount = input.vendors.filter(v => !v.unassigned).length;
  const title = input.vendors.length === 1 ? `Satın alma raporu · ${input.vendors[0].name}` : 'Satın alma raporu';
  const eyebrow = [input.storeName, 'İç kullanım'].filter(Boolean).join(' · ');

  const kpis = [
    ['Sipariş kalemi', docNumber(lines.length), vendorCount === 1 ? '1 tedarikçi' : `${vendorCount} tedarikçi`, ''],
    [
      'Tutar',
      `${estimateCount > 0 ? '~' : ''}${docMoneyRounded(total, input.currencyCode)}`,
      estimateCount > 0 ? `${estimateCount} kalem satış fiyatıyla` : 'alış fiyatıyla',
      '',
    ],
    ['Acil', docNumber(urgent), 'tedarik süresi içinde biter', urgent > 0 ? ' crit' : ''],
    ['Yolda', `${docNumber(incoming)} adet`, 'bu kalemler için açık siparişte', ''],
  ]
    .map(
      ([label, value, sub, tone]) =>
        `<div><span class="eyebrow">${up(label)}</span><span class="v${tone}">${escapeHtml(value)}</span><span class="s">${escapeHtml(sub)}</span></div>`,
    )
    .join('');

  const font = (file: string) => `${input.fontBaseUrl}/fonts/${file}`;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)} · ${escapeHtml(docDateTime(input.generatedAt, input.timeZone))}</title>
<style>
  @font-face{font-family:"Geist";src:url("${font('Geist-Variable.woff2')}") format("woff2");font-weight:100 900;font-display:block}
  @font-face{font-family:"Geist Mono";src:url("${font('GeistMono-Variable.woff2')}") format("woff2");font-weight:100 900;font-display:block}
  @page{size:A4 landscape;margin:0}
  :root{--ink:#18181b;--ink2:#3f3f46;--muted:#71717a;--faint:#a1a1aa;--hairline:#e4e4e7;--wash:#f4f4f5;--crit:#dc2626;--warn:#d97706}
  *{box-sizing:border-box}
  html,body{margin:0;background:#fff;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:"Geist",-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:8.2pt;line-height:1.4;font-variant-numeric:tabular-nums}
  .page{width:100%;border-collapse:collapse}
  .page>thead td,.page>tfoot td{height:11mm;padding:0}
  .page>tbody>tr>td{padding:0 13mm}
  .eyebrow{font-family:"Geist Mono",ui-monospace,Menlo,monospace;font-size:6.6pt;font-weight:500;letter-spacing:.04em;color:var(--muted)}
  .top{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding-bottom:12px;border-bottom:1.1pt solid var(--ink)}
  .top h1{font-size:16pt;font-weight:600;letter-spacing:-.02em;margin:3px 0 0}
  .params{display:flex;gap:18px}
  .params div{display:grid;gap:1px;text-align:right}
  .params b{font-weight:500;font-size:8.8pt}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:.75pt solid var(--hairline)}
  .kpis div{padding:10px 0;display:grid;gap:2px}
  .kpis div+div{padding-left:14px;border-left:.75pt solid var(--hairline)}
  .kpis .v{font-family:"Geist Mono",ui-monospace,Menlo,monospace;font-size:14pt;font-weight:500;letter-spacing:-.02em}
  .kpis .v.crit{color:var(--crit)}
  .kpis .s{color:var(--muted);font-size:7.6pt}
  .grp{margin-top:14px}
  .grp-h{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding-bottom:5px;break-after:avoid}
  .grp-h b{font-size:9.6pt;font-weight:600}
  .grp-h span{color:var(--muted)}
  .grp-h .sub{color:var(--ink);font-weight:600}
  .rt{width:100%;border-collapse:collapse;table-layout:fixed}
  .rt th{font-family:"Geist Mono",ui-monospace,Menlo,monospace;font-weight:500;font-size:6.4pt;letter-spacing:.04em;color:var(--muted);text-align:left;padding:5px 6px;border-top:.75pt solid var(--ink);border-bottom:.75pt solid var(--hairline);white-space:nowrap;overflow:hidden}
  .rt td{padding:5px 6px;border-bottom:.75pt solid var(--hairline);vertical-align:middle;overflow-wrap:anywhere}
  .rt tr{break-inside:avoid}
  .rt th:first-child,.rt td:first-child{padding-left:0}
  .rt th:last-child,.rt td:last-child{padding-right:0}
  .rt .n{text-align:right;white-space:nowrap}
  .pn{font-weight:500}
  .vr,.dim,.sug{color:var(--muted)}
  .code{font-family:"Geist Mono",ui-monospace,Menlo,monospace;font-size:7pt;color:var(--muted)}
  .ord{font-weight:600}
  .cover{display:flex;gap:6px;align-items:center;justify-content:flex-end}
  .cover .d{min-width:22px;text-align:right}
  .cover .d.crit{color:var(--crit)} .cover .d.warn{color:var(--warn)}
  .bar{position:relative;width:62px;height:5px;background:var(--wash);border-radius:3px;flex:none}
  .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--ink2)}
  .bar i.crit{background:var(--crit)} .bar i.warn{background:var(--warn)}
  .bar u{position:absolute;top:-2px;bottom:-2px;width:1px;background:var(--ink)}
  .foot{margin-top:14px;padding-top:8px;border-top:.75pt solid var(--hairline);display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--muted);font-size:7.2pt}
  .foot .bar{display:inline-block;width:32px;vertical-align:middle;margin-right:5px}
  .dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:5px;vertical-align:1px}
</style></head><body>
<table class="page"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>
  <header class="top">
    <div><div class="eyebrow">${up(eyebrow)}</div><h1>Satın alma raporu</h1></div>
    <div class="params">
      <div><span class="eyebrow">${up('Hazırlandı')}</span><b>${escapeHtml(docDateTime(input.generatedAt, input.timeZone))}</b></div>
      <div><span class="eyebrow">${up('Satış penceresi')}</span><b>Son ${input.salesWindowDays} gün</b></div>
      <div><span class="eyebrow">${up('Hedef stok')}</span><b>${input.targetStockDays} gün</b></div>
    </div>
  </header>
  <div class="kpis">${kpis}</div>
  ${input.vendors.map(v => vendorTable(v, input)).join('')}
  <div class="foot">
    <span><span class="bar"><i class="crit" style="width:35%"></i><u style="left:55%"></u></span>Çubuk: kaç gün yeter · çizgi: tedarik süresi</span>
    <span><span class="dot" style="background:var(--crit)"></span>Tedarik süresi içinde biter</span>
    <span><span class="dot" style="background:var(--warn)"></span>İki tedarik süresinden kısa</span>
    <span>Öneri "36 → 40": ihtiyaç → koli / en az sipariş yuvarlaması</span>
    ${estimateCount > 0 ? '<span>~ Alış fiyatı yok, satış fiyatı kullanıldı</span>' : ''}
    <span>Flowventory · bu rapor tedarikçiye gönderilmez</span>
  </div>
</td></tr></tbody></table>
</body></html>`;
}
