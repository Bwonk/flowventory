# FLOWVENTORY — Proje Durum Raporu

---

## 1. Projenin Temel Amacı

**Flowventory** — ikas e-ticaret platformu üzerinde çalışan, mağaza sahiplerine **stok takibi + satış analitiği** sunan bir admin uygulaması (embedded iframe app).

**Rakip referans:** Stocki (benzer bir stok yönetim aracı)

**Çözdüğü problem:**

- Mağaza sahibi hangi ürünün stoğu azalıyor, hangisi hiç satılmıyor (ölü stok), hangi ürüne ne kadar sermaye bağlı, bunu tek ekrandan görsün
- Ürün bazlı satış trendini (ciro/adet) ve görüntülenme sayısını zaman içinde izlesin
- (Planlanan) Tedarikçiye gönderilecek hazır bir satın alma listesi çıkarsın

**Teknik yapı:** Next.js 15 + Prisma (SQLite) + ikas GraphQL API + Cloudflare tunnel (iframe embed için) + shadcn/ui + Tailwind + evilcharts (recharts tabanlı özel chart kütüphanesi)

**Proje yolu:** `C:\Users\ozen\Desktop\flowventory\flowventory` (iki iç içe klasör — komutlar içtekinden çalıştırılır)

---

## 2. Ne Yaptık — Tamamlanan Özellikler

### A) Temel Altyapı (önceki oturumlar)

- ikas CLI kurulumu, OAuth akışı
- GraphQL client + codegen ile otomatik tip üretimi (`src/lib/ikas-client/`)
- Prisma + SQLite veritabanı kurulumu
- Dashboard + Stok Takibi + Ayarlar sayfaları (3 ana route, iframe embed)

### B) Dashboard Yeniden Tasarımı

- 5 metrikli tek KPI kartı (dikey ayraçlı): 30 günlük ciro, aktif SKU, kritik stok, ölü stok (bağlı sermaye ile), ortalama stok ömrü
- Bildirimler paneli kaldırıldı, verileri KPI kartlarına dağıtıldı (veri tekrarı önlendi)
- SKU bazlı stok sağlığı dağılımı (3 kolon: sağlıklı/az kalan/tükendi)
- En Çok Satanlar + Az Kalan listeleri, ortak `ProductListCard` component'ında birleştirildi
- Deep link desteği: `?filter=tukendi`, `?filter=az-kalan`, `?view=dead`, `?product={id}` (modal otomatik açılır)
- **Ölü stok tespiti:** stok var ama hiç satılmamış veya 180+ gün satılmıyor → bağlı sermaye hesabıyla (stok × ortalama fiyat) gösteriliyor
- `avgDaysRemaining` hesap hatası düzeltildi (86053 gibi anlamsız değerler çıkıyordu — validDays filtresi eklendi)

### C) Chart Sistemi (projenin en büyük iş bloğu)

**Birleştirme:** Dashboard ve ürün detay modal'ındaki grafikler artık **tek** `TrendChart` component'ını paylaşıyor (`src/components/shared/TrendChart.tsx`). Eski `SalesChart.tsx` silindi.

**Görsel motor:** evilcharts monospace-bar-chart entegre edildi

- Barlar normalde ince (`COLLAPSED_SCALE = 0.1`), hover'da tam genişliğe açılıyor — bilinçli tasarım kararı
- `BarShape` component'ı export edilip yeniden kullanılabilir hale getirildi

**Periyot sistemi (birkaç iterasyonda olgunlaştı):**

- Son 24 Saat (saatlik) / Son 7 Gün / Son 30 Gün / Son 1 Yıl (aylık) / Özel Aralık
- Tek dropdown toolbar: yatay hızlı-aralık pill'leri (mentör önerisiyle: 50% rounded, hafif border, kenar blur ile yatay scroll) + shadcn Calendar (özel tarih için)
- Metrik seçici (Ciro/Satış Adedi/Görüntülenme) ayrı segmented control, tarih seçiciden bağımsız

**Saatlik görüntülenme sistemi (baştan kuruldu):**

- Yeni Prisma modeli: `ProductViewHourly` (productId + date + hour unique)
- Tracker script (`public/tracker.js`) hem günlük hem saatlik tabloya yazıyor
- Yeni API modu: `/api/product-view/stats?hourly=true&date=X` → 24 saatlik veri (boş saatler 0 ile dolduruluyor)
- Frontend: `hourlyViewFetch` prop'u ile ayrı veri kaynağı, `last24h + views` kombinasyonu artık çalışıyor

**Varyant mantığı:** Bir varyant seçildiğinde "Görüntülenme" metriği otomatik gizleniyor (varyant bazlı view verisi tutulmuyor, yanıltıcı gösterim engellendi). "Tüm Varyantlar" seçilince geri geliyor.

### D) Kritik Bug Çözümleri

**Dialog + Popover focus-trap çakışması** (en zorlu debug süreci):

- Belirti: Modal içindeki date picker'a tıklanamıyor, tıklamalar arkadaki chart'a geçiyordu
- İlk denemeler (`onInteractOutside` guard, z-index ayarları) yetersiz kaldı
- Kök sebep bulundu: Popover, Dialog'un dışına (`document.body`) portal ediliyordu, Dialog'un focus-trap mekanizması bunu "dışarı" sayıp event'leri blokluyordu
- Çözüm: Popover'ı Dialog içine portal etmek (`container` prop, `PopoverPrimitive.Portal`'a iletildi)
- İkinci bug: `useRef` ile tutulan container, `ref.current` değişimi re-render tetiklemediği için ilk render'da hep `null` kalıyordu (sayfa yenilenince açık/bozuk görünüyordu, modal kapat-aç yapınca düzeliyordu)
- Kesin çözüm: `useRef` yerine **callback ref + `useState`** kullanıldı — node bağlanınca state güncelleniyor, re-render tetikleniyor

**Diğer düzeltmeler:**

- Modal boyutu büyütüldü (`max-w-7xl`, `md:h-[780px]`) — iki aylık takvim taşmasın diye
- Modal'a backdrop blur eklendi (`backdrop-blur-sm bg-black/40`)

### E) Görüntülenme Takibi (Storefront Tracker)

- `public/tracker.js` — storefront'a ikas admin panelinden manuel eklenen script
- `window.IkasEvents` üzerinden `PRODUCT_VIEW` event'i dinleniyor
- `sessionStorage` ile 30 dakikalık cooldown (aynı ziyaretçi tekrar tekrar saymasın)
- CORS'lu, token'sız `POST /api/track/view` endpoint'i
- İki ayrı tablo mimarisi: `ProductView` (günlük özet, hızlı okuma) + `ProductViewHourly` (saatlik detay) — performans için bilinçli ayrıştırma

### F) UI/UX Kalitesi

**Skeleton Loading:**

- Genel "Yükleniyor..." / "Please wait..." yerine sayfaya özel skeleton'lar
- Next.js colocation pattern'i: her sayfanın `_components/` klasöründe kendi skeleton'ı (`DashboardSkeleton`, `StokSkeleton`)
- Ayarlar sayfası için skeleton **gereksiz bulunup oluşturulmadı** (server component, loading state yok — analiz sürecinde doğrulandı)
- Sidebar loading sırasında stabil kalıyor

**Badge Mimarisi (katmanlı, kısmi tamamlandı):**

- shadcn `ui/badge.tsx` (temel) → `badge-tokens.ts` (renk/boyut sabitleri) → `StatusBadge.tsx` (stok durumu badge'i)
- Dağınık badge kullanımları `StatusBadge`'e çevrildi
- **Eksik:** StockLifeBadge, CategoryBadge, TrendBadge henüz yapılmadı

**Component Refactor:**

- 1300 satırlık tek `index.tsx` dosyası mantıklı modüllere bölündü
- `src/components/home-page/` altında: `types.ts`, `constants.ts`, `lib/` (product, filtering, analytics, format, csv), `hooks/`, `components/`, `product-detail/`

### G) Veri Katmanı Genişletmesi

- ikas GraphQL introspection ile doğrulandı: `Product` tipinde `vendor` (tedarikçi) ve `brand` (marka) alanları var
- Bu alanlar `LIST_PRODUCT` sorgusuna eklendi, codegen çalıştırıldı
- Test mağazasında doğrulama: 32 üründen **4'ünde vendor dolu**, 28'inde null; **32'sinde brand dolu**
- `buyPrice` (alış fiyatı) alanının `ProductPrice` tipinde var olduğu introspection ile doğrulandı (opsiyonel Float)
- **Henüz yapılmadı:** `buyPrice` sorguya eklenip test edilmedi

### H) Kod Kalitesi Denetimi (şu an aktif süreç)

`.cursor/rules/ruler_cursor_instructions.mdc` + `AGENTS.md` okutularak derin analiz yaptırıldı.

**FAZ 1 — Analiz (tamamlandı):**

- 18 kuralın listesi çıkarıldı (TypeScript strict, GraphQL sorgu konumu, session doğrulama, iframe pattern'leri, tasarım kuralları vb.)
- Ölü kod taraması: 8 kullanılmayan dosya + 9 ölü export tespit edildi
- Yanlış pozitifler doğru ayıklandı (`use-base-home-page.ts`, `jwt-helpers.ts` canlı çıktı)
- Kural ihlalleri tespit edildi (aşağıda detaylı)

**FAZ 2 — Uygulama (devam ediyor):**

- **Adım 1 tamamlandı:** 8 ölü dosya silindi (`TopSellers.tsx`, `Pagination.tsx`, `TumuCard.tsx`, kullanılmayan shadcn UI parçaları — `select`, `tabs`, `alert`, `chart`, gereksiz `AyarlarSkeleton.tsx`), 9 ölü export temizlendi. `pnpm tsc --noEmit`: 0 hata.
- **Sırada:** closeLoader taşıma → güvenlik açığı düzeltme → `any` temizliği → ikas App Actions kaldırma

---

## 3. Tespit Edilen Kural İhlalleri (Kod Denetiminden)


| Öncelik    | Kod | Sorun                                                                                                                                                  | Konum                                                                                         | Durum                           |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------- |
| **YÜKSEK** | V1  | `product-view/stats` endpoint'i session doğrulaması yapmıyor — merchant scope olmadan tüm görüntülenme verisi açık (multi-tenant veri sızıntısı riski) | `src/app/api/product-view/stats/route.ts:24`                                                  | Tespit edildi, düzeltilmedi     |
| ORTA       | V2  | `any` kullanımları (generated tipler yerine)                                                                                                           | `analytics/route.ts`, `analytics/hourly/route.ts`, `api-requests.ts`, `auth-token/manager.ts` | Tespit edildi, düzeltilmedi     |
| ORTA       | V3  | `closeLoader()` sadece `dashboard/page.tsx`'te çağrılıyor, `stok/` ve `ayarlar/` sayfalarında yok                                                      | iframe pattern kuralı                                                                         | Tespit edildi, düzeltilmedi     |
| DÜŞÜK      | V4  | `session.ts` içinde `[key: string]: any`                                                                                                               | —                                                                                             | Tespit edildi, düzeltilmedi     |
| DÜŞÜK      | V5  | Duplicate route: `api/actions/order-detail` ile `api/ikas/actions/order-detail` neredeyse birebir aynı, config'te kayıtlı değil                        | —                                                                                             | C1 kapsamında kaldırılacak      |
| DÜŞÜK      | V6  | Renk token tutarsızlığı — bazı yerlerde CSS token (`bg-card`), çoğunda hardcode hex                                                                    | DESIGN.md ile ilişkili                                                                        | Kapsam dışı bırakıldı (ayrı iş) |


**Onaylanan ek karar (C1):** ikas "App Actions" özelliği (order-detail/order-list zinciri — şablondan kalma, dashboard'dan erişilmiyor, çekirdek ürünün parçası değil) **tamamen kaldırılacak**. Etkilenen: 2 sayfa, 4 API route, `lib/i18n.ts` (tamamen buna bağlıydı), `ikas.config.json` actions bloğu, ilgili dokümanlar.

---

## 4. Ne Yapmadık — Eksikler

### Brief'te olup henüz kod yazılmayanlar

1. **Satın alma raporu / PDF export** — En büyük eksik. Çok detaylı bir plan çıkarıldı ama hiç uygulanmadı:
  - Tedarikçi bazlı gruplama (`vendor` verisi doğrulandı: 4/32 ürün dolu)
  - Sipariş miktarı formülü: `(günlükSatış × (hedefGün + leadTime)) - mevcutStok`, 5'in katına yuvarlama
  - `buyPrice` fallback stratejisi (yoksa `sellPrice` + "tahmini" işareti)
  - Print CSS ile PDF üretimi (Türkçe karakter sorunu olmadığı için `jspdf` yerine tercih edildi)
  - Kapsam v1'e indirildi: tek rapor türü + modal + print view (arşiv sayfası, snapshot loglama v2'ye bırakıldı)
  - **Durum:** `buyPrice` testi yapılmadan kod temizliği sürecine geçildi, rapor özelliğine hiç başlanmadı
2. **Webhook — anlık stok güncelleme** — brief'te var, hiç dokunulmadı

### Kod kalitesi (devam eden temizlik sürecinde planlı ama henüz uygulanmadı)

3. Güvenlik açığı (V1) — auth doğrulaması eksik endpoint
4. `any` kullanımları (V2) — 3 dosyada
5. `closeLoader` konsolidasyonu (V3)
6. Badge mimarisi yarım — StockLifeBadge, CategoryBadge, TrendBadge yok

---

## 5. Yan İşler (Projeyle Doğrudan İlgisiz ama Bu Dönemde Yapıldı)

- Diğer ikas geliştiricilerinin genel platform sorularına yanıt verildi (tema yayınlama limitleri, cache/queue davranışı, trial/ödeme akışı — hepsinde "ikas destek'e sor" yönlendirmesi net biçimde yapıldı, bilinmeyen konularda uydurma bilgi verilmedi)
- Node.js sürüm sorunu çözüldü: pnpm v22.13+ Node istiyordu, sistemde v20 vardı → nvm-windows kuruldu, kurulum sürecinde birkaç PATH/symlink sorunu (klasör çakışması, restart gerekliliği) aşıldı
- Antigravity IDE'ye ikas ve context7 MCP sunucuları eklendi (farklı config formatı — `serverUrl` kullanımı, `type` alanı gerekmiyor)
- Dosya yapısı analiz edildi; `globals/` vs `lib/`, `helpers/` vs `lib/` gibi örtüşen klasörler tespit edildi ama düşük öncelikli bulunup dokunulmadı

---

## 6. Şu An Tam Olarak Neredeyiz

Kod temizliği/kural denetimi sürecinin **ortasındayız**:

```
FAZ 1 (analiz + plan)     ✅ Tamamlandı, onaylandı
FAZ 2 — Adım 1/5          ✅ Ölü kod silindi (8 dosya + 9 export)
FAZ 2 — Adım 2/5          ⏳ closeLoader → layout.tsx taşıma (sırada)
FAZ 2 — Adım 3/5          ⬜ V1 güvenlik açığı düzeltme
FAZ 2 — Adım 4/5          ⬜ any temizliği (V2 + V4)
FAZ 2 — Adım 5/5          ⬜ ikas App Actions kaldırma (C1)
```

Bu süreç bitince proje **teknik borç açısından temiz** olacak, ama **fonksiyonel olarak eksik** kalacak (satın alma raporu, webhook yok).

---

## 7. Önerilen Sıra (Devam İçin)

1. **Kod temizliği sürecini bitir** — güvenlik açığı (V1) özellikle öncelikli, bu bir veri sızıntısı riski
2. **Seed data'yı sil** — production'a yaklaşırken unutulmasın diye şimdiden not edilmeli
3. `**buyPrice` testi → satın alma raporu** — asıl brief maddesi, projenin en büyük eksiği, plan zaten hazır
4. **Webhook**

---

