# Flowventory — Senior Seviye Analiz & Yol Haritası

> Kaynak: kod taraması (2026-08-11) + `FLOWVENTORY-DURUM-RAPORU.md`, `DESIGN.md`, `AGENTS.md`/`CLAUDE.md`.
> Not: Durum raporundaki bazı maddeler artık güncel değil — aşağıda "Rapor Düzeltmeleri" bölümünde.

---

## 0. Rapor Düzeltmeleri (kod ile doğrulandı)

| Rapordaki iddia | Gerçek durum |
|---|---|
| V1: `product-view/stats` auth'suz | ✅ **Çözülmüş.** `route.ts:27-30` `getUserFromRequest` + tüm sorgular `merchantId` scope'lu |
| Webhook "hiç dokunulmadı" | ✅ **Yapılmış.** `api/ikas/webhook/route.ts` — HMAC imza doğrulaması dahil |
| App Actions kaldırılacak (C1) | ✅ **Kaldırılmış.** `ikas.config.json` → `"actions": []`, ilgili route'lar yok |
| `any` kullanımları (V2/V4) | ✅ **Temiz.** `src/` altında (generated hariç) tek bir `: any` / `as any` yok |

Yani teknik borç temizliği düşünülenden ileride. Asıl açık **mimari** ve **ürün** tarafında.

---

## 1. Kritik Bulgular (P0 — düzeltilmeden "senior" denemez)

### B1. Sayfalama yok — veri sessizce eksik ⚠️ EN KRİTİK
`graphql-requests.ts`'teki `listProduct` ve `listOrderForAnalytics` sorguları `page`/`limit` argümanı ve `count`/`hasNext` alanı **istemiyor**. ikas API varsayılan sayfa boyutu döndürür.

**Sonuç:** 50+ ürünlü veya 50+ siparişli bir mağazada:
- Dashboard ciro rakamı **yanlış** (eksik),
- "Aktif ürün" sayısı **yanlış**,
- Stok listesi **eksik**,
- Kullanıcıya hiçbir uyarı **verilmiyor** — sessiz veri kaybı.

Bu, ürünü gerçek bir mağazada kullanılamaz yapar. Her şeyden önce bu.

### B2. Timezone tutarsızlığı — saatlik grafik yanlış
`api/track/view/route.ts:31-32`:
```ts
const today = now.toISOString().split('T')[0];  // UTC tarih
const hour  = now.getHours();                   // sunucu yerel saati
```
UTC tarih + yerel saat karışımı. TR (UTC+3) sunucuda 00:00–03:00 arası görüntülenmeler **bir önceki güne** yazılır. Ayrıca `analytics/hourly` `setHours()` ile sunucu yerel saatini, `analytics` `toISOString()` ile UTC'yi kullanıyor — ikisi aynı veriyi farklı günlere düşürüyor.
**Doğrusu:** merchant'ın timezone'u tek kaynak olmalı (ikas'tan alınıp `MerchantSettings`'te saklanmalı), tüm bucket'lama o TZ'de yapılmalı.

### B3. "Ölü stok" hesabı yapısal olarak hatalı
`analytics/route.ts:97` → `topProducts` **`.slice(0, 10)`**. Dashboard (`page.tsx:230-240`) ölü stoğu bu 10 kayıttan hesaplıyor:
> "topProducts içinde yoksa → hiç satılmamış → ölü stok"

11. sıradaki iyi satan ürün **ölü stok** olarak işaretlenir. `avgDaysRemaining`, `getDaysRemaining`, "en çok satanlar" da aynı kırık girdiden besleniyor. KPI kartındaki "bağlı sermaye" rakamı bu yüzden güvenilmez.

### B4. Tracking endpoint'i istismara açık
`api/track/view` — token yok, `Access-Control-Allow-Origin: *`, rate-limit yok, `merchantId` doğrulanmıyor.
Herhangi biri curl ile başka bir mağazanın `merchantId`'sine sınırsız view yazabilir. Analitik verisi = ürünün çekirdek değeri; kirletilebilir olması ciddi.
**Ayrıca:** hata cevaplarında (`400`/`500`) CORS header'ı yok → tarayıcı hatayı okuyamıyor.

### B5. SQLite + tek dosya = production'a çıkamaz
`schema.prisma` → `provider = "sqlite"`, `file:./dev.db`. Serverless/multi-instance deploy'da yazma kilitlenir, dosya ephemeral FS'te kaybolur. Multi-tenant bir SaaS için Postgres şart.

### B6. Ayarlar localStorage'da
`stock-threshold.ts` — stok eşiği `localStorage`'da. Yani: cihaz değişince kaybolur, aynı mağazadaki iki kullanıcı farklı sayılar görür, sunucu tarafı (rapor/alarm) bu eşiği bilemez. Merchant bazlı DB'ye taşınmalı.

### B7. Hatalar kullanıcıya görünmüyor
Dashboard'daki tüm `fetch*` fonksiyonları `catch (e) { console.error(e) }`. API 500 dönerse kullanıcı **boş bir dashboard** görür ve "verim yok" sanır. Error state / retry / toast yok. Error boundary yok.

### B8. Test yok, CI yok
0 test dosyası, `.github/` yok, `lint` script'i var ama hiçbir gate'e bağlı değil. Fiyat/stok/gün hesapları (`analytics.ts`, `product.ts`, `format.ts`) saf fonksiyon — test edilmemesi için sebep yok.

---

## 2. Orta Öncelikli Bulgular (P1)

| # | Bulgu | Konum |
|---|---|---|
| B9 | Her dashboard açılışı ikas'a 2 ağır `listOrder` + 1 `listProduct` atıyor. Cache/persist katmanı yok → yavaş + rate-limit riski | `analytics/route.ts` |
| B10 | `buyPrice` hiç sorgulanmıyor → kâr marjı, gerçek bağlı sermaye, COGS hesaplanamıyor. Bağlı sermaye `sellPrice` ile hesaplanıyor (şişik) | `graphql-requests.ts:139` |
| B11 | Para birimi `₺` hardcoded, dil Türkçe hardcoded. ikas çok pazarlı; `currencyCode` sipariş verisinde var ama kullanılmıyor | `dashboard/page.tsx:31` |
| B12 | Webhook'ta idempotency yok — ikas retry ederse tekrar işlenir; işlenen event log'u tutulmuyor | `webhook/route.ts` |
| B13 | Webhook mantığı tuhaf: ikas'tan gelen stok event'ini alıp aynı değeri `saveVariantStocks` ile ikas'a geri yazıyor. Bu bir no-op; olması gereken **yerel stok snapshot'ını güncellemek** | `webhook/route.ts:94` |
| B14 | App **uninstall** webhook'u yok → token'lar ve merchant verisi silinmiyor (KVKK/GDPR açığı) | — |
| B15 | `zod` bağımlılık olarak var ama hiçbir route input'u doğrulamıyor | tüm API |
| B16 | Sadece `stocks[0]` okunuyor → çok depolu mağazalarda diğer lokasyonlar yok sayılıyor | `page.tsx:50`, `product.ts` |
| B17 | Renk token drift'i: `bg-green-100`, `bg-red-50`, `text-green-800` gibi Tailwind default'ları DESIGN.md token'ları yerine kullanılıyor | `dashboard/page.tsx` ve diğerleri |
| B18 | Mock analytics production dışında **otomatik** devreye giriyor (sipariş yoksa). Bu davranış görünür değil — geliştirici gerçek veri sanabilir | `analytics/route.ts:19` |
| B19 | Repoda artık dosyalar: `_check_token.ts`, `CLAUDE.md.bak`, commit edilmemiş `src/app/api/dev/`, `mock-analytics.ts`, `seed-orders.ts` | root |
| B20 | 36 adet `console.*` — yapılandırılmış logging yok, request-id yok, monitoring (Sentry vb.) yok | tüm proje |
| B21 | `dashboard/page.tsx` 621 satır — 12 `useMemo`'luk iş mantığı sayfada. `CLAUDE.md`: "sayfalarda iş mantığı olmasın" kuralının ihlali | `dashboard/page.tsx` |
| B22 | Badge mimarisi yarım (StockLifeBadge / CategoryBadge / TrendBadge yok) | `shared/badges/` |
| B23 | `closeLoader()` sadece dashboard'da; `stok/` ve `ayarlar/`'da yok | iframe kuralı |

---

## 3. Mimari Öneri: Sync Katmanı

Şu anki model **read-through**: her istekte ikas'a sor, bellekte hesapla. Bu; B1 (sayfalama), B3 (top-10 kısıtı), B9 (yavaşlık), B10 (marj) sorunlarının **ortak kökü**.

Senior çözüm: **kendi veri deponu tut.**

```
ikas (kaynak)
   │
   ├── Webhook (stock/order created|updated)  ──┐
   └── Nightly full sync (cron, sayfalı)      ──┤
                                                ▼
                              Postgres (Prisma) — merchant scope'lu
                              ├── ProductSnapshot   (ürün/varyant/stok/fiyat/buyPrice)
                              ├── SalesDaily        (variantId × gün → adet, ciro, COGS)
                              ├── ProductView(Hourly)  ← mevcut
                              ├── MerchantSettings  (eşikler, TZ, para birimi, leadTime)
                              ├── SyncLog / WebhookEvent (idempotency + gözlemlenebilirlik)
                              └── PurchaseOrder / PurchaseOrderLine
                                                │
                                                ▼
                                    API route'ları (hızlı, tam, doğru)
```

Kazanımlar: tüm katalog üzerinde doğru hesap (top-10 kısıtı yok), <100ms dashboard, tarihsel trend (ikas'ta olmayan), COGS/marj, alarm ve zamanlanmış rapor için sunucu tarafı veri.

---

## 4. Eklenebilecek Özellikler (ürün değeri sırasına göre)

### Katman 1 — Rakiple eşitlenmek (Stocki paritesi)
1. **Satın Alma Raporu / PO** — brief'in en büyük eksiği. Tedarikçi (`vendor`) bazlı gruplama, `(günlükSatış × (hedefGün + leadTime)) − mevcutStok` formülü, `buyPrice` fallback'i, print-CSS ile PDF. Planı zaten hazır.
2. **Yeniden sipariş noktası (reorder point) + emniyet stoğu** — satış hızının standart sapmasıyla; sadece "azaldı" değil "ne zaman ve ne kadar sipariş et".
3. **Stok yaşlandırma (aging) tablosu** — 0-30 / 30-60 / 60-90 / 90-180 / 180+ gün kovaları, her kovada bağlı sermaye.
4. **Toplu stok düzenleme** — tablodan inline düzenleme → `saveVariantStocks` ile ikas'a yazma. Elinizdeki tek mutation zaten bu; salt-okunur bir araçtan işlem yapabilen bir araca terfi.

### Katman 2 — Farklılaşma
5. **ABC/XYZ analizi** — ciroya göre A/B/C, talep oynaklığına göre X/Y/Z. 9 kutuluk matris; hangi ürüne dikkat, hangisine otomasyon.
6. **Satış hızı & tükenme tahmini (stockout forecast)** — "Bu ürün 12 gün sonra tükenir" + takvim görünümü.
7. **Sell-through & stok devir hızı (turnover)** — dönemsel, kategori/marka kırılımlı.
8. **Görüntülenme → satış dönüşümü** — elinizde view verisi VAR, kimse bunu kullanmıyor. "Çok görüntülenip az satan" = fiyat/görsel/açıklama sorunu. Bu **rakipte olmayan**, tracker yatırımını değere çeviren özellik. En yüksek ROI'lu fikir.
9. **Alarm & bildirim** — eşik altı, ölü stok, ani satış artışı → e-posta / webhook / Slack. Zamanlanmış (günlük/haftalık) özet raporu.
10. **Tedarikçi yönetimi** — leadTime, min sipariş miktarı, iletişim; `vendor` verisi zaten çekiliyor (4/32 dolu → kullanıcıya "tedarikçi eksik" uyarısı ver).

### Katman 3 — Olgunluk
11. **Kaydedilmiş görünümler / filtreler** — "Kritik + Kışlık kategori" gibi, URL paylaşılabilir.
12. **Excel/CSV export** — mevcut CSV'yi genişlet; rapor bazlı export.
13. ~~**Çoklu depo desteği**~~ — **kapsam dışı.** B16'nın veri tutarsızlığı giderildi (frontend artık tüm depoları topluyor, StockEditor depo bazlı yazıyor). Ürünleşmiş hâli (depo adları, depolar arası transfer önerisi) ikas Admin API'sinde `listStockLocation` benzeri bir sorgu olmadığı için yapılamıyor — MCP list + introspect ile doğrulandı, `getMerchant` de depo bilgisi vermiyor. Depoları "DEPO 1 / DEPO 2" diye numaralandırmaktan öteye gidemeyeceğimiz için yarım bir özellik olarak bırakmak yerine plandan çıkarıldı. ikas bu sorguyu eklerse yeniden değerlendirilir.
14. **Onboarding akışı** — kurulumdan sonra 3 adım: tracker kur → eşikleri ayarla → ilk raporu gör. Şu an kullanıcı boş dashboard'a düşüyor.
15. **Faturalandırma (ikas recurring charge)** — App Store'da satılacaksa zorunlu; plan limitleri (ürün sayısı, rapor sayısı).
16. **i18n (TR/EN)** — ikas'ın yurtdışı mağazaları için gerekli; `lib/i18n.ts` silinmişti, yeniden ve doğru şekilde.
17. **Audit log** — kim ne zaman stok değiştirdi / PO oluşturdu.

---

## 5. Uygulama Planı (fazlı)

### FAZ 1 — Doğruluk & Güvenlik *(bunlar bitmeden özellik eklemeyin)*
| # | İş | Bulgu |
|---|---|---|
| 1.1 | `listProduct` / `listOrder` sorgularına `pagination` + `count`/`hasNext` ekle, MCP ile şemayı doğrula, codegen çalıştır, `fetchAllPages()` yardımcı fonksiyonu yaz | B1 |
| 1.2 | Merchant timezone'u tek kaynak yap; tüm gün/saat bucket'lamasını ona göre yeniden yaz | B2 |
| 1.3 | `topProducts` slice'ını kaldır; satış toplamını ayrı bir `salesByVariant` haritası olarak tam döndür → ölü stok / gün hesaplarını düzelt | B3 |
| 1.4 | `track/view`: merchantId'yi imzalı token ile doğrula, IP+ürün bazlı rate-limit, tüm cevaplara CORS, zod ile body validasyonu | B4, B15 |
| 1.5 | Postgres'e geç (Prisma provider + migration), `DATABASE_URL` env'e | B5 |
| 1.6 | Hata durumlarını UI'a taşı: error state + retry + boundary | B7 |
| 1.7 | Artık dosyaları temizle, `dev/` route'unu ve mock'u açıkça işaretle (banner ile görünür kıl) | B18, B19 |

### FAZ 2 — Temel Altyapı
| # | İş |
|---|---|
| 2.1 | `MerchantSettings` tablosu → eşik, TZ, para birimi, leadTime, hedefGün (B6) |
| 2.2 | `ProductSnapshot` + `SalesDaily` + nightly sync + webhook ile artımlı güncelleme (B9, B13) |
| 2.3 | `WebhookEvent` idempotency tablosu + uninstall webhook'u ile veri temizliği (B12, B14) |
| 2.4 | `buyPrice` sorguya ekle, fallback stratejisi, marj/COGS hesapları (B10) |
| 2.5 | Vitest + saf fonksiyonlar için test paketi; GitHub Actions'ta `tsc --noEmit` + `lint` + `test` (B8) |
| 2.6 | Yapılandırılmış logger + Sentry (B20) |

### FAZ 3 — Ürün Özellikleri
3.1 Satın Alma Raporu / PO → 3.2 Reorder point & emniyet stoğu → 3.3 Görüntülenme→satış dönüşümü → 3.4 ABC/XYZ + aging → 3.5 Alarm & zamanlanmış rapor → 3.6 Toplu stok düzenleme

### FAZ 4 — Cila
4.1 Dashboard iş mantığını `lib/` + hook'lara taşı (B21) · 4.2 Badge mimarisini tamamla (B22) · 4.3 `closeLoader`'ı layout'a taşı (B23) · 4.4 DESIGN.md token uyumu (B17) · 4.5 i18n · 4.6 Onboarding · 4.7 Faturalandırma

---

## 6. Önerilen İlk Adım

**1.1 (sayfalama) + 1.3 (top-10 kısıtı)** birlikte yapılmalı — ikisi de aynı şeyi bozuyor: gösterilen sayılar doğru değil. Bir günlük iş, ürünün güvenilirliğini sıfırdan bire çıkarır. Bundan sonra 1.2 (timezone) ve 1.4 (tracking güvenliği).
