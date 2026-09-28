import path from 'node:path';
import { Document, Font, Page, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { displayName, monogram } from './profile';
import { docDate, docMoney, packLabel } from './format';
import type { PurchaseOrderDocument } from './purchase-order';

/**
 * Satın alma siparişi PDF'i (A4) — e-posta eki ve "PDF" kanalı. Sunucuda
 * çizilir; fontlar `src/lib/documents/fonts` (Geist, OFL) — Vercel paketine
 * next.config `outputFileTracingIncludes` ile girer.
 *
 * Dil DESIGN.md'nin kâğıt karşılığı: mürekkep metin, hairline ayraçlar, mono
 * mikro-etiketler, tabular rakamlar; renk yalnız "teyit edin" uyarısında.
 */

const FONT_DIR = path.join(process.cwd(), 'src/lib/documents/fonts');
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: 'Geist',
    fonts: [
      { src: path.join(FONT_DIR, 'Geist-Regular.ttf'), fontWeight: 400 },
      { src: path.join(FONT_DIR, 'Geist-Medium.ttf'), fontWeight: 500 },
      { src: path.join(FONT_DIR, 'Geist-SemiBold.ttf'), fontWeight: 600 },
    ],
  });
  Font.register({
    family: 'GeistMono',
    fonts: [
      { src: path.join(FONT_DIR, 'GeistMono-Regular.ttf'), fontWeight: 400 },
      { src: path.join(FONT_DIR, 'GeistMono-Medium.ttf'), fontWeight: 500 },
    ],
  });
  // Varsayılan heceleme İngilizce kurallarıyla Türkçe kelimeleri böler.
  Font.registerHyphenationCallback(word => [word]);
  fontsRegistered = true;
}

const C = {
  ink: '#18181b',
  ink2: '#3f3f46',
  muted: '#71717a',
  faint: '#a1a1aa',
  hairline: '#e4e4e7',
  warn: '#b45309',
  brandInk: '#131318',
  brandPaper: '#fafafa',
  brandLime: '#cbf200',
};

const PAD_X = 42;

const s = StyleSheet.create({
  page: { fontFamily: 'Geist', fontSize: 8.6, lineHeight: 1.45, color: C.ink, paddingTop: 40, paddingBottom: 60, paddingHorizontal: PAD_X },
  eyebrow: { fontFamily: 'GeistMono', fontWeight: 500, fontSize: 6.8, letterSpacing: 0.25, color: C.muted },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottomWidth: 1.1, borderBottomColor: C.ink },
  store: { flexDirection: 'row', alignItems: 'center', maxWidth: 300 },
  logo: { width: 30, height: 30, borderRadius: 6, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  logoText: { color: '#ffffff', fontWeight: 600, fontSize: 13 },
  storeName: { fontSize: 13, fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.15 },
  storeSub: { fontSize: 8, color: C.muted },
  poId: { alignItems: 'flex-end' },
  poNum: { fontFamily: 'GeistMono', fontWeight: 500, fontSize: 21, letterSpacing: -0.4, lineHeight: 1.1, marginTop: 2 },
  meta: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: C.hairline },
  metaCell: { flex: 1, paddingVertical: 9 },
  metaCellNext: { paddingLeft: 12, borderLeftWidth: 0.75, borderLeftColor: C.hairline },
  metaValue: { fontSize: 9.4, fontWeight: 500, marginTop: 2 },
  metaMuted: { color: C.muted, fontWeight: 400 },
  parties: { flexDirection: 'row', paddingTop: 14, paddingBottom: 18 },
  party: { flex: 1, paddingRight: 14 },
  partyName: { fontSize: 9.4, fontWeight: 600, marginTop: 3, marginBottom: 1 },
  partyLine: { color: C.ink2 },
  partyMono: { fontFamily: 'GeistMono', fontSize: 7.8, color: C.muted },
  th: { flexDirection: 'row', borderTopWidth: 0.75, borderTopColor: C.ink, borderBottomWidth: 0.75, borderBottomColor: C.hairline, paddingVertical: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: C.hairline, paddingVertical: 7 },
  cIdx: { width: 18 },
  cProduct: { flex: 1, paddingRight: 8 },
  cSku: { width: 96, paddingRight: 8 },
  cQty: { width: 54, textAlign: 'right' },
  cUnit: { width: 72, textAlign: 'right' },
  cTotal: { width: 78, textAlign: 'right' },
  cCheckHead: { width: 40, alignItems: 'flex-end' },
  cCheck: { width: 40, alignItems: 'flex-end', paddingRight: 6 },
  idx: { fontFamily: 'GeistMono', fontSize: 7.5, color: C.faint, paddingTop: 1 },
  pn: { fontWeight: 500 },
  vr: { color: C.muted },
  sku: { fontFamily: 'GeistMono', fontSize: 7.5, color: C.ink2, paddingTop: 1 },
  qty: { fontWeight: 600, fontSize: 9.4, textAlign: 'right' },
  pack: { fontSize: 7.5, color: C.muted, textAlign: 'right' },
  num: { textAlign: 'right' },
  tbc: { color: C.warn, textAlign: 'right' },
  box: { width: 9, height: 9, borderWidth: 0.75, borderColor: C.faint, borderRadius: 1.5, marginTop: 1 },
  bottom: { flexDirection: 'row', paddingTop: 14 },
  terms: { flex: 1, paddingRight: 28 },
  term: { flexDirection: 'row', marginTop: 4, color: C.ink2 },
  termDash: { width: 9, color: C.muted },
  totals: { width: 196 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4.5, borderBottomWidth: 0.75, borderBottomColor: C.hairline },
  totalLabel: { color: C.muted },
  grand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 9, paddingBottom: 6, borderBottomWidth: 1.1, borderBottomColor: C.ink },
  grandValue: { fontFamily: 'GeistMono', fontWeight: 500, fontSize: 14, letterSpacing: -0.5, lineHeight: 1 },
  totalNote: { fontSize: 7.5, color: C.muted, marginTop: 5 },
  sign: { flexDirection: 'row', marginTop: 30 },
  signCell: { flex: 1, borderTopWidth: 0.75, borderTopColor: C.ink2, paddingTop: 5 },
  signTitle: { fontWeight: 600 },
  signSub: { fontSize: 7.8, color: C.muted },
  footer: { position: 'absolute', left: PAD_X, right: PAD_X, bottom: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', fontSize: 7.5, color: C.muted },
  footerMono: { fontFamily: 'GeistMono', width: 160 },
  made: { flexDirection: 'row', alignItems: 'center' },
});

const upper = (text: string) => text.toLocaleUpperCase('tr-TR');

function Eyebrow({ children, color }: { children: string; color?: string }) {
  return <Text style={color ? [s.eyebrow, { color }] : s.eyebrow}>{upper(children)}</Text>;
}

/** Raf işareti (BrandMark geometrisi, 64'lük ızgara) — alt bilgideki küçük imza. */
function BrandMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={0} y={0} width={64} height={64} rx={16} ry={16} fill={C.brandInk} />
      <Rect x={18} y={14} width={8} height={36} fill={C.brandPaper} />
      <Rect x={18} y={14} width={28} height={8} fill={C.brandPaper} />
      <Rect x={30} y={28} width={10} height={10} fill={C.brandLime} />
    </Svg>
  );
}

function Party({ label, name, lines, mono }: { label: string; name: string | null; lines: Array<string | null>; mono?: string | null }) {
  const shown = lines.filter((l): l is string => Boolean(l));
  return (
    <View style={s.party}>
      <Eyebrow>{label}</Eyebrow>
      {name && <Text style={s.partyName}>{name}</Text>}
      {shown.map(line => (
        <Text key={line} style={s.partyLine}>
          {line}
        </Text>
      ))}
      {mono && <Text style={s.partyMono}>{mono}</Text>}
    </View>
  );
}

export function PurchaseOrderPdf({ doc }: { doc: PurchaseOrderDocument }) {
  const money = (n: number) => docMoney(n, doc.currencyCode);
  const date = (iso: string) => docDate(iso, doc.timeZone);
  const name = displayName(doc.store);
  const legal = doc.store.legalName && doc.store.legalName !== name ? doc.store.legalName : null;
  const hasAddress = doc.store.addressLines.length > 0;
  const terms = [
    doc.vendor.email
      ? 'Siparişi 2 iş günü içinde e-postayı yanıtlayarak teyit edin.'
      : 'Siparişi 2 iş günü içinde teyit edin.',
    `İrsaliye ve faturada ${doc.label} numarasını belirtin.`,
    'Kısmi teslim kabul edilir. Kalan adetler için yeni tarih bildirin.',
    ...(doc.unpricedCount > 0
      ? [`Fiyatı yazılmayan ${doc.unpricedCount} kalemin birim fiyatını teyitte bildirin.`]
      : []),
  ];

  return (
    <Document title={`${doc.label} · Satın alma siparişi`} author={name} creator="Flowventory" producer="Flowventory" language="tr">
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <View style={s.store}>
            <View style={s.logo}>
              <Text style={s.logoText}>{monogram(name)}</Text>
            </View>
            <View>
              <Text style={s.storeName}>{name}</Text>
              {legal && <Text style={s.storeSub}>{legal}</Text>}
            </View>
          </View>
          <View style={s.poId}>
            <Eyebrow>Satın alma siparişi</Eyebrow>
            <Text style={s.poNum}>{doc.label}</Text>
          </View>
        </View>

        <View style={s.meta}>
          <View style={s.metaCell}>
            <Eyebrow>Sipariş tarihi</Eyebrow>
            <Text style={s.metaValue}>{date(doc.orderedAt)}</Text>
          </View>
          <View style={[s.metaCell, s.metaCellNext]}>
            <Eyebrow>Beklenen teslim</Eyebrow>
            <Text style={s.metaValue}>
              {doc.expectedAt ? date(doc.expectedAt) : 'Belirtilmedi'}
              {doc.leadDays !== null && <Text style={s.metaMuted}> · {doc.leadDays} gün</Text>}
            </Text>
          </View>
          <View style={[s.metaCell, s.metaCellNext]}>
            <Eyebrow>Para birimi</Eyebrow>
            <Text style={s.metaValue}>{doc.currencyCode}</Text>
          </View>
          <View style={[s.metaCell, s.metaCellNext]}>
            <Eyebrow>Kalem · Adet</Eyebrow>
            <Text style={s.metaValue}>
              {doc.lines.length} · {doc.totalQty.toLocaleString('tr-TR')}
            </Text>
          </View>
        </View>

        <View style={s.parties}>
          <Party label="Tedarikçi" name={doc.vendor.name} lines={[doc.vendor.email, doc.vendor.phone]} />
          <Party
            label="Sipariş veren"
            name={doc.store.legalName ?? name}
            lines={[doc.store.taxOffice ? `${doc.store.taxOffice} V.D.` : null, doc.storeEmail, doc.store.phone]}
            mono={doc.store.taxNumber ? `VKN ${doc.store.taxNumber}` : null}
          />
          {hasAddress ? (
            <Party label="Teslimat adresi" name={name} lines={doc.store.addressLines} />
          ) : (
            <View style={s.party} />
          )}
        </View>

        <View style={s.th}>
          <Text style={[s.eyebrow, s.cIdx]}>#</Text>
          <Text style={[s.eyebrow, s.cProduct]}>{upper('Ürün')}</Text>
          <Text style={[s.eyebrow, s.cSku]}>SKU</Text>
          <Text style={[s.eyebrow, s.cQty]}>ADET</Text>
          <Text style={[s.eyebrow, s.cUnit]}>{upper('Birim fiyat')}</Text>
          <Text style={[s.eyebrow, s.cTotal]}>TUTAR</Text>
          <View style={s.cCheckHead}>
            <Text style={s.eyebrow}>GELDİ</Text>
          </View>
        </View>
        {doc.lines.map(line => {
          const pack = packLabel(line.qty, doc.vendor.casePack);
          return (
            <View key={line.index} style={s.tr} wrap={false}>
              <Text style={[s.idx, s.cIdx]}>{String(line.index).padStart(2, '0')}</Text>
              <View style={s.cProduct}>
                <Text style={s.pn}>{line.productName}</Text>
                {line.variantName && <Text style={s.vr}>{line.variantName}</Text>}
              </View>
              <Text style={[s.sku, s.cSku]}>{line.sku ?? '—'}</Text>
              <View style={s.cQty}>
                <Text style={s.qty}>{line.qty.toLocaleString('tr-TR')}</Text>
                {pack && <Text style={s.pack}>{pack}</Text>}
              </View>
              {line.unitCost === null ? (
                <>
                  <Text style={[s.tbc, s.cUnit]}>Teyit edin</Text>
                  <Text style={[s.tbc, s.cTotal]}>—</Text>
                </>
              ) : (
                <>
                  <Text style={[s.num, s.cUnit]}>{money(line.unitCost)}</Text>
                  <Text style={[s.num, s.cTotal]}>{money(line.lineTotal ?? 0)}</Text>
                </>
              )}
              <View style={s.cCheck}>
                <View style={s.box} />
              </View>
            </View>
          );
        })}

        <View style={s.bottom} wrap={false}>
          <View style={s.terms}>
            <Eyebrow>Notlar ve koşullar</Eyebrow>
            {terms.map(term => (
              <View key={term} style={s.term}>
                <Text style={s.termDash}>–</Text>
                <Text style={{ flex: 1 }}>{term}</Text>
              </View>
            ))}
          </View>
          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Ara toplam</Text>
              <Text>{money(doc.subtotal)}</Text>
            </View>
            {doc.unpricedCount > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Fiyatı teyit bekleyen</Text>
                <Text>{doc.unpricedCount} kalem</Text>
              </View>
            )}
            <View style={s.grand}>
              <Eyebrow color={C.ink}>Toplam</Eyebrow>
              <Text style={s.grandValue}>{money(doc.subtotal)}</Text>
            </View>
            {doc.unpricedCount > 0 && <Text style={s.totalNote}>Teyit bekleyen kalemler toplama dahil değildir.</Text>}
          </View>
        </View>

        <View style={s.sign} wrap={false}>
          <View style={[s.signCell, { marginRight: 24 }]}>
            <Text style={s.signTitle}>Hazırlayan</Text>
            <Text style={s.signSub}>{name} · Satın alma</Text>
          </View>
          <View style={s.signCell}>
            <Text style={s.signTitle}>Tedarikçi onayı</Text>
            <Text style={s.signSub}>Kaşe / imza · tarih</Text>
          </View>
        </View>

        {/* Her sayfada sipariş no. Sayfa sayacı (render prop) bu altlıkta çizilmiyordu — bilinçli olarak yok. */}
        <View style={s.footer} fixed>
          <Text style={s.footerMono}>{doc.label}</Text>
          <Text>Bu belge fatura yerine geçmez.</Text>
          <View style={[s.made, { width: 160, justifyContent: 'flex-end' }]}>
            <BrandMark size={10} />
            <Text style={{ marginLeft: 5 }}>Flowventory ile hazırlandı</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPurchaseOrderPdf(doc: PurchaseOrderDocument): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<PurchaseOrderPdf doc={doc} />);
}
