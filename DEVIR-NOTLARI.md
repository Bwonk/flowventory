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
| `SECRET_COOKIE_PASSWORD` | Eski `.env`'den kopyala (32+ karakter) |
| `NEXT_PUBLIC_GRAPH_API_URL` | `https://api.myikas.com/api/v2/admin/graphql` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://{storeName}.myikas.com/admin` |
| `NEXT_PUBLIC_DEPLOY_URL` | Tunnel/deploy URL'i (her `ikas dev` oturumunda değişiyorsa güncelle) |
| `MERCHANT_TIMEZONE` | `Europe/Istanbul` (opsiyonel, varsayılan bu) |
| `RESEND_API_KEY` / `RESEND_FROM` | Opsiyonel — e-posta alarmı istenirse resend.com'dan |

```bash
pnpm prisma migrate dev     # boş dev.db'yi 8 migration'dan kurar + client üretir
pnpm views:import           # görüntülenme geçmişini (1095+504 satır) + ayarları geri yükler
pnpm dev                    # (veya ikas CLI dev komutu)
```

**Kurulum sonrası zorunlu 2 adım:**
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
- [ ] curl ile token'sız `POST /api/track/view` → 401 dönmeli
- [ ] 60+ hızlı istek → 429 dönmeli (rate limit)

### D) Satın Alma Raporu (`/dashboard/rapor`)
- [ ] Tedarikçili/tedarikçisiz ürünler doğru gruplanıyor mu
- [ ] Formül mantıklı mı: satış hızı × (hedef + tedarik süresi) + emniyet − stok, 5'in katı
- [ ] "acil" rozeti: stok < sipariş noktası olan üründe çıkıyor mu
- [ ] Tedarik süresi / hedef gün değişince rapor yeniden hesaplanıyor mu (kalıcı mı — sayfa yenile)
- [ ] Yazdır/PDF: sidebar ve kontroller gizli, tablo temiz çıkıyor mu (`~` işaretleri açıklamalı)

### E) Analiz (`/dashboard/analiz`)
- [ ] ABC dağılımı mantıklı mı (en çok satan A'da mı)
- [ ] Yaşlandırma kovaları + bağlı sermaye; 180+/satışsız kovaları kırmızı mı

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

### K) Regresyon
- [ ] Stok Takibi sayfası: filtreler, deep link'ler (`?filter=tukendi`, `?view=dead`, `?product=...`)
- [ ] Ürün modal'ı: chart periyotları (24s/7g/30g/1y/özel), varyant seçince "Görüntülenme" gizlenmesi
- [x] `pnpm test` (80 test) + `pnpm build` + `pnpm lint` yeni makinede geçiyor
- [ ] GitHub Actions: push sonrası CI yeşil mi (ilk kez çalışacak)

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
| **1.5 Postgres geçişi** | Mentör cevabı (soru hazır, `FLOWVENTORY-SENIOR-PLAN.md` sohbetinde: tek VM + WAL eşiği, geçiş zamanı, hosting, yedekleme) | Şema hazır; geçiş = provider değişikliği + migration'ları yeniden üretme. Production öncesi ŞART (SQLite tek yazıcı + serverless'ta dosya kaybı) |
| **4.5 i18n (TR/EN)** | Hedef pazar/dil kararı | Tüm string'ler Türkçe; App Store'a yurtdışı hedefiyle çıkmadan önce. Yarım çeviri yapma — tek seferde |
| **4.7 Faturalandırma** | Fiyat/plan kararı | ikas `createMerchantAppPayment` + `getMerchantLicence` akışı; karar sonrası ~1 gün |
| **Sentry / hata izleme** | Hesap + DSN | Logger hazır (prod'da JSON); Sentry eklemek ~15 dk |

### Plandan kalan küçük teknik borçlar
| Kod | İş | Durum |
|---|---|---|
| B11 | `₺` hardcode — para birimi artık `src/lib/format.ts` + `src/lib/currency.ts` üzerinden; sync varyant fiyatlarından `currencyCode`'u tespit edip `MerchantSettings`'e yazıyor | ✅ Tamamlandı (dil/i18n ayrı iş, hâlâ bloklu) |
| B16 | Frontend `stocks[0]` yerine tüm depoları topluyor (`getVariantStock`) — sync ile tutarlı; StockEditor çok depoluysa depo bazlı düzenliyor | ✅ Tutarsızlık giderildi (depo adları + transfer önerisi hâlâ Katman 3) |
| B20 | Tüm `console.*` çağrıları `logger`'a taşındı (client dahil); OAuth callback'te parametre loglayan satır kaldırıldı (code/signature sızıntısı) | ✅ Tamamlandı |
| — | Rate limiter in-memory — multi-instance deploy'da Redis'e taşınmalı | Postgres kararıyla birlikte |
| — | Lint uyarıları: `TrendChart` hourlyViews dep (gerçek bug'dı — 24s/görüntülenme grafiği asenkron veriyi göstermiyordu) + `<img>` → `next/image` | ✅ Temiz (0 uyarı) |
| — | `src/app/api/dev/seed-orders` + mock-analytics: production build'e girmiyor ama App Store öncesi tamamen silinebilir | Not — manuel QA bitene kadar dursun |

### Plandan kalan özellik fikirleri (Katman 2-3, hiç başlanmadı)
- Zamanlanmış özet raporu (günlük/haftalık e-posta — alarm altyapısı hazır, cron gerekiyor)
- Kaydedilmiş görünümler / paylaşılabilir filtreler
- Excel export (CSV var; rapor bazlı export yok)
- Çoklu depo desteği (B16'nın ürünleşmişi: depo bazlı stok + transfer önerisi)
- Sell-through / stok devir hızı metriği
- Tedarikçi yönetimi (leadTime'ı tedarikçi bazına indir; vendor'suz ürünler için uyarı)
- Audit log (kim ne zaman stok değiştirdi)
- XYZ analizi (talep oynaklığı — ABC'nin yanına 9 kutu matris)

### Üretim öncesi hatırlatmalar
- [ ] Postgres'e geç (yukarıda)
- [ ] Seed/demo verilerini temizle (`prisma/seed.ts`, dev route)
- [ ] `NEXT_PUBLIC_DEPLOY_URL` kalıcı domain'e sabitle (webhook + tracker bu URL'i kullanıyor)
- [ ] Resend'de doğrulanmış gönderici domain'i (`RESEND_FROM`)
- [ ] `.env` production değerleriyle; `SECRET_COOKIE_PASSWORD` yenile

---

## 4. BUGÜN TAMAMLANANLARIN ÖZETİ (referans)

- **Faz 1 (doğruluk/güvenlik):** sayfalama (`fetchAllPages`), timezone tek kaynak, ölü stok hesabı düzeltildi (top-10 kısıtı kalktı), track/view HMAC token + rate limit + zod + CORS, hata durumları (ErrorState/boundary), temizlik + mock banner
- **Faz 2 (altyapı):** MerchantSettings (sunucu destekli eşikler), sync katmanı (ProductSnapshot/SalesDaily/SyncLog — analytics DB'den), webhook idempotency + kayıt + uninstall temizliği, buyPrice + "~tahmini", Vitest (55 test) + CI, logger
- **Faz 3 (özellikler):** Satın Alma Raporu (+emniyet stoğu/reorder point, print/PDF), Envanter Analizi (ABC + yaşlandırma), dönüşüm içgörüsü, stok düzenleme (ikas'a yazar), alarmlar (3 kural, zil + Resend)
- **Faz 4 (cila):** dashboard refactor (metrics + hook), badge mimarisi tamam (Trend/StockLife/Category), status renk token'ları, onboarding kartı
- **Devir:** her şey commit'li + push'lu (`main`), görüntülenme verisi `pnpm views:import` ile taşınabilir
