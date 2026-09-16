# FLOWVENTORY — Devir Notları (Yeni Bilgisayarda Devam)

> Kaynak: `FLOWVENTORY-SENIOR-PLAN.md` (4 fazlık plan) — bugün itibarıyla 4 faz da uygulandı.
> Bu dosya: ① yeni bilgisayara kurulum, ② test edilecekler, ③ kalan işler.

---

## 1. YENİ BİLGİSAYARA KURULUM (sırayla)

### Gereksinimler
- Node.js 22+ (nvm-windows önerilir), pnpm 10+, git
- ikas CLI (tunnel için kullanıyorsanız)

### Adımlar
```bash
git clone https://github.com/Bwonk/flowventory.git
cd flowventory
pnpm install
```

**`.env` dosyasını oluştur** — repo'da YOK (secret'lar), tek elle taşınacak parça.
Şablon `.env.example`'da; doldurulacak değerler:

| Değişken | Nereden |
|---|---|
| `NEXT_PUBLIC_CLIENT_ID` / `CLIENT_SECRET` | ikas Partner panelindeki app bilgileri (eski bilgisayardaki `.env`'den kopyala) |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon → proje → **`dev` branch** → Connect: havuzlu (pooled) ve doğrudan adres. Production'daki `main` branch'ini localde asla kullanma |
| `SECRET_COOKIE_PASSWORD` | Eski `.env`'den kopyala (32+ karakter) |
| `NEXT_PUBLIC_GRAPH_API_URL` | `https://api.myikas.com/api/v2/admin/graphql` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://{storeName}.myikas.com/admin` |
| `NEXT_PUBLIC_DEPLOY_URL` | Tunnel/deploy URL'i (her `ikas dev` oturumunda değişiyorsa güncelle) |
| `MERCHANT_TIMEZONE` | `Europe/Istanbul` (opsiyonel, varsayılan bu) |
| `RESEND_API_KEY` / `RESEND_FROM` | Opsiyonel — e-posta alarmı / özet raporu istenirse resend.com'dan |
| `CRON_SECRET` | Opsiyonel — zamanlanmış özet raporu için (`openssl rand -hex 32`); boşsa `/api/cron/digest` kapalı (503) |

```bash
pnpm prisma migrate deploy  # Neon dev branch'ine migration'ları uygular (zaten güncelse no-op)
pnpm prisma generate
pnpm views:import           # yalnız boş bir dev branch'ine: görüntülenme geçmişi + ayarlar
pnpm dev                    # (veya ikas CLI dev komutu)
```

Veritabanı artık Neon'da olduğu için bilgisayar değiştirmek veri taşımayı gerektirmez — aynı
dev branch'ine bağlanmak yeterli. Şema değişikliğinde: `pnpm prisma migrate dev --name <ad>`.

**Kurulum sonrası zorunlu 2 adım (yalnız boş bir veritabanıyla başlarken):**
1. **Uygulamayı ikas'tan yeniden yetkilendir** — yeni DB'de AuthToken yok; ayrıca webhook kaydı (order/product/stock scope'ları) OAuth callback'te yapılıyor.
2. **Ayarlar → Takip scriptini yeniden kur** — eski kurulu script token'sız; yeni script HMAC imzalı token içeriyor, yoksa görüntülenmeler 401 alır.

### Windows'a özgü bilinen sorun
`pnpm dev` çalışırken `prisma migrate/generate` **EPERM** hatası verir (query engine DLL kilidi).
Çözüm: önce dev server'ı durdur (Ctrl+C), migration'ı çalıştır, sonra tekrar başlat.

---

## 2. TEST LİSTESİ (manuel QA — hiçbiri henüz gerçek ortamda test edilmedi)

### A) Temel akış
- [ ] Dashboard ilk açılış: sync tetiklenir (birkaç sn), KPI'lar + onboarding kartı gelir
- [ ] İkinci açılış hızlı mı? (analytics artık DB'den, 30 dk staleness)
- [ ] "Demo verisi" banner'ı: sipariş yokken görünüyor mu, `mock=1` paramı çalışıyor mu
- [ ] Hata durumu: dev server'da DB'yi bozup "Tekrar dene" butonunun geldiğini gör

### B) Sayfalama & veri doğruluğu (Faz 1'in kalbi)
- [ ] 50+ ürünlü senaryoda tüm ürünler listeleniyor mu (eskiden ilk 50'de kesiliyordu)
- [ ] Ölü stok listesi mantıklı mı (artık top-10 kısıtı yok, tüm satış verisine bakıyor)
- [ ] Ciro rakamı ikas panelindeki 30 günlük ciroyla tutuyor mu
- [ ] Gece 00:00–03:00 arası görüntülenme doğru güne mi yazılıyor (TZ düzeltmesi)

### C) Tracking güvenliği
- [ ] Script yeniden kurulduktan sonra storefront'ta ürün gezince view sayacı artıyor mu
- [x] ~~curl ile token'sız `POST /api/track/view` → 401 dönmeli~~ → otomatik test
- [x] ~~60+ hızlı istek → 429 dönmeli (rate limit)~~ → otomatik test

> Son iki madde `src/app/api/track/view/__tests__/route.test.ts` ile kapatıldı:
> yanlış token → 401, token alanı yok / bozuk JSON → 400, başka mağazanın
> token'ıyla yazma (cross-tenant) → 401, 61. istek → 429, rate limit'in token
> doğrulamasından önce çalışması ve OPTIONS preflight. `pnpm test` ile koşuyor,
> curl gerekmiyor. İlk madde storefront gerektirdiği için manuel kalıyor.

### D) Satın Alma Raporu (`/dashboard/rapor`)
- [ ] Tedarikçili/tedarikçisiz ürünler doğru gruplanıyor mu
- [ ] Formül mantıklı mı: satış hızı × (hedef + tedarik süresi) + emniyet − stok, 5'in katı
- [ ] "acil" rozeti: stok < sipariş noktası olan üründe çıkıyor mu
- [ ] Tedarik süresi / hedef gün değişince rapor yeniden hesaplanıyor mu (kalıcı mı — sayfa yenile)
- [ ] Yazdır/PDF: sidebar ve kontroller gizli, tablo temiz çıkıyor mu (`~` işaretleri açıklamalı)

### E) Analiz (`/dashboard/analiz`)
- [ ] ABC dağılımı mantıklı mı (en çok satan A'da mı)
- [ ] Yaşlandırma kovaları + bağlı sermaye; 180+/satışsız kovaları kırmızı mı
- [ ] Satış Hızı bloğu: sell-through yüzdesi ile "N adet satıldı / M adet elde" tutarlı mı
- [ ] Ürün dağılımı sayıları toplamı = tablodaki ürün sayısı mı (stoksuz + satışsız ürünler hariç)
- [ ] "X ürün tedarik süresinden önce tükeniyor" listesi: Ayarlar'da tedarik süresini değiştirince liste değişiyor mu
- [ ] Tükeniş sütunu: stoksuz ürün "tükendi", satışsız ürün "satış yok", çok yavaş ürün "2+ yıl" gösteriyor mu
- [ ] Tükeniş tarihi mağaza saat diliminde mi (gün kayması yok)

### F) Dönüşüm kartı (dashboard)
- [ ] Görüntülenme/satış/dönüşüm % değerleri; "düşük dönüşüm" rozeti çıkıyor mu
- [ ] Tracker kurulu değilken Ayarlar'a yönlendiren boş durum

### G) Stok düzenleme (ürün detay modal'ı)
- [ ] Varyant seç → STOK satırı → kalem → yeni değer → ✓
- [ ] **ikas admin panelinde stok gerçekten değişti mi (en kritik test)**
- [ ] Dashboard/analiz yeni değeri görüyor mu (snapshot tazeleme)

### H) Webhook'lar (yeniden yetkilendirme sonrası)
- [ ] ikas'ta stok değiştir → snapshot güncellendi mi (log: "Webhooks registered")
- [ ] Aynı webhook'un retry'ı çift işlem yapmıyor mu (`deduped: true`)
- [ ] Test mağazasında sipariş oluştur → sonraki analytics okuması yeni siparişi görüyor mu

### I) Bildirimler
- [ ] Kritik stok/ölü stok varsa sync sonrası zilde bildirim var mı
- [ ] Panel açınca rozet sıfırlanıyor mu; aynı bildirim aynı gün tekrar oluşmuyor mu
- [ ] (Resend key girildiyse) e-posta geliyor mu — Ayarlar'dan adres + toggle

### J) Onboarding
- [ ] 3 adımın durumları doğru mu; adım tamamlanınca ✓; ✕ ile kapatınca geri gelmiyor mu

### M) Zamanlanmış özet raporu
- [ ] Ayarlar → E-posta bildirimleri: Günlük/Haftalık + gün/saat kaydediliyor, sayfa yenilenince korunuyor
- [x] "Örnek özet gönder" → kayıtlı adrese e-posta geliyor (Resend key gerekli) — 10 Eyl 2026, curl ile; 429 sınırı denenmedi
- [x] Cron: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/digest` — seçilen saatte (mağaza TZ'si, +3 saat telafi penceresi) `sent: 1`, aynı saatte ikinci çağrı `due: 0` (DigestLog tekrar göndermiyor) — 10 Eyl 2026 geçti, yanlış anahtar 401
- [ ] E-postadaki tükenen/az kalan/ölü stok sayıları dashboard'la tutuyor mu
- [ ] Günlük özet dünü, haftalık özet dünden geriye 7 günü kapsıyor (bugün dahil değil)

### N) Stok geçmişi, Stok Yolu ve kural tabanlı takip (16 Eyl 2026 — hiçbiri tarayıcıda test edilmedi)
- [ ] **Migration:** `pnpm prisma migrate deploy` (dev branch) → `StockHistory` + `TrackingRule` tabloları, `Notification.ruleId` kolonu (iki migration DB'siz schema diff'ten üretildi)
- [ ] Ayarlar → senkron → Prisma Studio'da tüm varyantlar `StockHistory`'de `baseline`; ikinci sync yeni satır yazmıyor; ikas'ta stok değiştir → tek `sync`/`refresh` satırı
- [ ] Ürün modal'ı → varyant seç → kalem → değer → Enter → popover "12 → 40 (+28) · ~N gün idare eder" → Onayla → toast; **ikas admin'de stok değişti mi**; "Geri Al" eski değeri yazıyor mu (ikas'ta da); Escape taslağı sıfırlıyor; popover dışına tıklamak modalı kapatmıyor; çok depoda TOPLAM satırı güncel; modal başlığı + arkadaki liste satırı anında güncel; hata → toast + düzenleme modunda kalma
- [ ] Modal 5 kart tek satırda, 780px'te taşma yok; varyant seçince kartlar + grafik varyanta daralıyor, görüntülenme "ürün geneli"
- [ ] Stok Yolu grafiği: geçmiş çizgi + BUGÜN + kesik projeksiyon + TÜKENİŞ/TEDARİK/KRİTİK işaretleri; 30G/90G; satışsız üründe "projeksiyon yapılamıyor"; yeni veride "Geçmiş toplanıyor"; taslak yazınca soluk ikinci projeksiyon; onay sonrası grafik + "Stok Değişimi 30G" kartı yenileniyor; "Satış" sekmesi eski grafik
- [ ] Ayarlar → Takip kuralları: kural ekle (ürün kapsamı, stok düşüşü 24s 5 adet) → ikas'ta stoğu 5 düşür → senkron → zilde `Radar` ikonlu bildirim + kural adı; e-posta açıksa Resend'de mail; ikinci senkronda tekrar yok (cooldown); anahtarı kapat → tetiklenmez; düzenle → cümle güncel; sil → listeden düşer
- [ ] Ürün/tedarikçi seçicide arama çalışıyor; tedarikçisiz mağazada "Tedarikçi atanmış ürün yok"
- [ ] Cron: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/rules` → `{ data: { merchants, evaluated, created, failed } }`; yanlış anahtar 401, CRON_SECRET boş 503

### K) Regresyon
- [ ] Stok Takibi sayfası: filtreler, deep link'ler (`?filter=tukendi`, `?view=dead`, `?product=...`)
- [ ] Ürün modal'ı: chart periyotları (24s/7g/30g/1y/özel), varyant seçince "Görüntülenme" gizlenmesi
- [x] `pnpm test` (115 test) + `pnpm build` + `pnpm lint` yeni makinede geçiyor
- [x] GitHub Actions: CI yeşil (teknik borç commit'lerinde de geçti)

### L) Teknik borç düzeltmelerinin QA'i (B11/B16/B20 sonrası)
- [ ] Fiyatlar her sayfada doğru para birimiyle mi (ilk sync sonrası; TRY dışı mağazada `$`/`€` görünmeli)
- [ ] Çok depolu mağazada dashboard stok sayısı = analiz sayfasındaki sayı (eskiden ilk depoyu okuyordu)
- [ ] Ürün modal'ı: tek depoda "STOK" satırı, çok depoda "TOPLAM STOK" + "DEPO 1/2…" satırları
- [ ] Bir depoyu düzenle → ikas admin'de **o depo** değişsin, diğeri sabit kalsın
- [ ] Grafik: 24 saat + "Görüntülenme" seçimi artık veri geldiğinde güncelleniyor mu

---

## 3. KALAN İŞLER

### Karar bekleyenler (bloklu)
| İş | Bekleyen karar | Not |
|---|---|---|
| ~~**1.5 Postgres geçişi**~~ | ✅ Mentör kararı (11 Eyl 2026): Neon serverless Postgres, hosting Vercel | Provider `postgresql`, SQLite migration'ları tek `init`'e indirildi. Local = Neon `dev` branch (Prisma'da provider env'den okunamadığı ve migration'lar SQL lehçesine özgü olduğu için local SQLite bırakıldı), production = `main` branch. Yedek: Neon'un zaman noktasına geri dönüşü — plan penceresini kontrol et |
| **RLS (satır düzeyi güvenlik)** | Lansman şartı mı? (mentöre sorulacak) | Kod her sorguyu `merchantId` ile filtreliyor + cross-tenant testi var. RLS ikinci katman: Prisma'da her sorguyu `set_config`'li transaction'a sarmak + cron/webhook/OAuth için bypass rolü gerekir |
| **Tracker yazma kuyruğu** | Ölçüm | Mentör "ufak kuyruk" önerdi; Postgres eşzamanlı upsert'i kaldırdığı için şimdilik yok. Serverless'ta bellek içi kuyruk çalışmaz → gerekirse Vercel Queues / Upstash |
| **4.5 i18n (TR/EN)** | Hedef pazar/dil kararı | Tüm string'ler Türkçe; App Store'a yurtdışı hedefiyle çıkmadan önce. Yarım çeviri yapma — tek seferde |
| **4.7 Faturalandırma** | Fiyat/plan kararı | ikas `createMerchantAppPayment` + `getMerchantLicence` akışı; karar sonrası ~1 gün |
| **Sentry / hata izleme** | Hesap + DSN | Logger hazır (prod'da JSON); Sentry eklemek ~15 dk |

### Plandan kalan küçük teknik borçlar
| Kod | İş | Durum |
|---|---|---|
| B11 | `₺` hardcode — para birimi artık `src/lib/format.ts` + `src/lib/currency.ts` üzerinden; sync varyant fiyatlarından `currencyCode`'u tespit edip `MerchantSettings`'e yazıyor | ✅ Tamamlandı (dil/i18n ayrı iş, hâlâ bloklu) |
| B16 | Frontend `stocks[0]` yerine tüm depoları topluyor (`getVariantStock`) — sync ile tutarlı; StockEditor çok depoluysa depo bazlı düzenliyor | ✅ Tutarsızlık giderildi (depo adları + transfer önerisi kapsam dışı — API yok) |
| B20 | Tüm `console.*` çağrıları `logger`'a taşındı (client dahil); OAuth callback'te parametre loglayan satır kaldırıldı (code/signature sızıntısı) | ✅ Tamamlandı |
| — | Rate limiter in-memory — multi-instance deploy'da Redis'e taşınmalı | Postgres kararıyla birlikte |
| — | Lint uyarıları: `TrendChart` hourlyViews dep (gerçek bug'dı — 24s/görüntülenme grafiği asenkron veriyi göstermiyordu) + `<img>` → `next/image` | ✅ Temiz (0 uyarı) |
| — | `src/app/api/dev/seed-orders` + mock-analytics: production build'e girmiyor ama App Store öncesi tamamen silinebilir | Not — manuel QA bitene kadar dursun |

### Plandan kalan özellik fikirleri (Katman 2-3, hiç başlanmadı)
- Kaydedilmiş görünümler / paylaşılabilir filtreler
- Excel export (CSV var; rapor bazlı export yok)
- Tedarikçi yönetimi (leadTime'ı tedarikçi bazına indir; vendor'suz ürünler için uyarı)
- Audit log (kim ne zaman stok değiştirdi)
- XYZ analizi (talep oynaklığı — ABC'nin yanına 9 kutu matris)

**Kapsam dışı bırakıldı:**
- ~~Çoklu depo desteği (depo adları + transfer önerisi)~~ — ikas Admin API'sinde depo/lokasyon listeleyen bir sorgu yok (MCP list + introspect ile doğrulandı; `getMerchant` de vermiyor). Depoları "DEPO 1 / DEPO 2" diye numaralandırmaktan öteye gidemez, yarım kalır. B16'daki **veri tutarsızlığı zaten giderildi** — eksik olan sadece ürünleşme. ikas bu sorguyu eklerse yeniden açılır.

**Tamamlananlar:**
- ~~Stok değişikliğinde onay~~ → StockEditor popover onayı + toast "Geri Al" (16 Eyl 2026); optimistic liste güncellemesi (`applyVariantStockChange`)
- ~~Ürün modal'ı metrik kartları~~ → 30G şerit + **Stok Yolu** grafiği (`src/lib/stock-history/`, `GET /api/stock-history`); kuram: uyarı yerine "kaç gün idare eder"
- ~~Alarm & bildirim (kural tabanlı)~~ → `TrackingRule` + `src/lib/rules/` (5 metrik, kayan pencere, ürün/tedarikçi kapsamı), Ayarlar'da bölüm, `GET|POST /api/cron/rules` + `rules-cron.yml`
- ~~Zamanlanmış özet raporu~~ → Ayarlar'da Kapalı/Günlük/Haftalık + gün/saat; `src/lib/digest/` (zamanlama, içerik, e-posta, orkestrasyon) + `GET|POST /api/cron/digest` (CRON_SECRET) + `POST /api/digest/test` (örnek gönderim). Harici zamanlayıcının saatte bir çağırması gerekir — bkz. üretim öncesi.
- ~~Sell-through / stok devir hızı metriği~~ → Analiz sayfası + `src/lib/reports/sell-through.ts`

### Üretim öncesi hatırlatmalar
- [x] Postgres'e geç — şema + migration hazır (yukarıda); production branch'ine `prisma migrate deploy` ilk deploy'da
- [ ] Seed/demo verilerini temizle (`prisma/seed.ts`, dev route)
- [ ] `NEXT_PUBLIC_DEPLOY_URL` kalıcı domain'e sabitle (webhook + tracker bu URL'i kullanıyor)
- [x] Resend'de doğrulanmış gönderici domain'i — kök domain eu-west-1'de verified (bkz. `RESEND-KURULUM.md`); production için ayrı sending anahtarı üretilecek
- [ ] `CRON_SECRET` (production için ayrı) üret → Vercel env + GitHub repo secret `CRON_SECRET`; repo variable `APP_URL`. Tetikleyici `.github/workflows/digest-cron.yml` (saatte bir) — Vercel Hobby cron'u günde bir kez çalışabildiği için GitHub Actions
- [ ] Kural cron'u: `.github/workflows/rules-cron.yml` digest ile aynı `CRON_SECRET` + `APP_URL`'i kullanır — ayrı kurulum gerekmez; deploy sonrası `workflow_dispatch` ile bir kez elle tetikle
- [ ] Vercel env production değerleriyle; `SECRET_COOKIE_PASSWORD` yenile. Neon'u Vercel Marketplace'ten bağla (`DATABASE_URL*` otomatik); bölge Frankfurt (`vercel.json` → `fra1`)
- [ ] ikas Partner paneli: uygulama + redirect URL'i production domain'ine çek → yeniden yetkilendir → takip scriptini yeniden kur
- [ ] Deploy sonrası: takip scripti kurulumu (`tracker.js` fonksiyon paketinde mi — `next.config.js` `outputFileTracingIncludes`), örnek özet, cron `workflow_dispatch` ile elle tetikle

---

## 4. BUGÜN TAMAMLANANLARIN ÖZETİ (referans)

- **Faz 1 (doğruluk/güvenlik):** sayfalama (`fetchAllPages`), timezone tek kaynak, ölü stok hesabı düzeltildi (top-10 kısıtı kalktı), track/view HMAC token + rate limit + zod + CORS, hata durumları (ErrorState/boundary), temizlik + mock banner
- **Faz 2 (altyapı):** MerchantSettings (sunucu destekli eşikler), sync katmanı (ProductSnapshot/SalesDaily/SyncLog — analytics DB'den), webhook idempotency + kayıt + uninstall temizliği, buyPrice + "~tahmini", Vitest (55 test) + CI, logger
- **Faz 3 (özellikler):** Satın Alma Raporu (+emniyet stoğu/reorder point, print/PDF), Envanter Analizi (ABC + yaşlandırma), dönüşüm içgörüsü, stok düzenleme (ikas'a yazar), alarmlar (3 kural, zil + Resend)
- **Faz 4 (cila):** dashboard refactor (metrics + hook), badge mimarisi tamam (Trend/StockLife/Category), status renk token'ları, onboarding kartı
- **Devir:** her şey commit'li + push'lu (`main`), görüntülenme verisi `pnpm views:import` ile taşınabilir
