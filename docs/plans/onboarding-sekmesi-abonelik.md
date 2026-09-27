# Başlarken sekmesi + abonelik başlatma

> Durum: **uygulandı** (27 Eyl 2026, Faz 0–5; push/deploy edilmedi). Canlı QA ve ödeme akışı teyidi: DEVIR-NOTLARI §J.
> Plandan sapmalar: Faz 1+2 tek commit (kart silinmeden hook değişemiyordu); `ChoiceGroup` alınmadı (TR'de dönem seçimi yok — YAGNI);
> `useControllableState` yerine yerel eşdeğer (`radix-ui/internal` moduleResolution'da çözülmüyor); kart girişinde `animate-enter`
> kullanılmadı (DESIGN.md: KPI karolarına mahsus); ikas codegen preset'i liste içi enum'ları atlıyordu → `patches/@ikas__admin-api-client.patch`;
> webhook abonelik durumu saklamaz, yalnız PAID'de "Aboneliğin aktif" bildirimi üretir; `AppTrial` yoksa ilk abonelik sorgusunda da oluşur (mevcut kurulumlar için backfill yok).
> Kararlar (kullanıcı, 27 Eyl 2026): **tek ücretli plan + deneme süresi** · sidebar kartı kalkar, yerine **nav'da "Başlarken" satırı + ilerleme rozeti** · önce belge, sonra fazlı uygulama · **deneme 14 gün** · **yıllık 980 TL** (KDV hariç) · nav ikonu `@heroicons-animated/rocket-launch` · Partner panel planı **gerçek deploy'da** oluşturulur (§6.2 "faturalandırma kapalı" modu).
> Bağlam: DEVIR-NOTLARI §4.6 Onboarding + §4.7 Faturalandırma (şimdiye dek "fiyat/plan kararı" bekliyordu).

## 1. Neden değişiyor

1. Sidebar footer'ındaki "Başlarken" kartı
   ([OnboardingCard.tsx](../../src/components/layout/OnboardingCard.tsx)) 214px kolona sıkışmış **tek-slayt
   carousel**: aynı anda tek adım görünür, açıklamalar kısaltılmak zorunda, adımın *neden* önemli olduğu
   anlatılamıyor, ikon modunda tamamen kayboluyor.
2. Uygulamada **faturalandırma yok**. App Store'da satılacaksa abonelik başlatma yolu şart; bunun doğal
   yeri kurulumun hemen ardı ("değer önce, ödeme sonra").
3. Tamamlanma tespiti çoğunlukla **localStorage** bayrağı: başka cihazda/tarayıcıda ilerleme sıfır görünür;
   senkron adımı sunucuda `SyncLog` olarak zaten biliniyorken istemci bayrağına bağlı.
4. Bilinen hata: eşiği bilinçli olarak varsayılan 5/10 seçen mağaza "eşik ayarlanmadı" görünür
   ([onboarding.ts:19-20](../../src/lib/onboarding.ts)).

## 2. Araştırma

### 2.1 cult-ui `onboarding` bileşeni

`npx shadcn add https://cult-ui.com/r/onboarding.json` **çalışmaz** — cult-ui.com CLI/curl isteklerine Vercel
güvenlik duvarıyla HTTP 429 döner (18 Eyl'de `popover-form` için de doğrulandı). Kaynak GitHub raw'dan alınır:
`https://raw.githubusercontent.com/nolly-studio/cult-ui/main/apps/www/registry/default/ui/onboarding.tsx`
(883 satır; demo `registry/default/example/onboarding-demo.tsx`).

**Kayıt:** `dependencies: @radix-ui/react-use-controllable-state, class-variance-authority`,
`registryDependencies: [button]`. İkisi de projede var (`useControllableState` → `radix-ui/internal`
şemsiye paketi), **yeni paket gerekmez**. Motion kullanmaz.

**API:**

| Parça | Ne yapar |
| --- | --- |
| `Onboarding` (Root) | `value/defaultValue/onValueChange` (1 tabanlı adım), `stepValue` (alt adım), `totalSteps`, `maxStepValue`, `canGoNext(step, stepValue)`, `onComplete`; context: `currentStep, setStep, handleNext, handleBack, handleComplete…` |
| `Onboarding.Step` | `step={n}` — aktif değilse `null` döner (unmount; çıkış animasyonu ve yerel state kaybolur) |
| `Onboarding.StepIndicator` | `role="progressbar"`, `data-state active\|completed\|inactive`, cva `dots \| pills` |
| `Onboarding.Header` / `Navigation` | başlık alanı; Geri + İleri/Tamamla butonları (`<fieldset>`) |
| `ChoiceGroup` (+`.Item`) | radyo grubu, `sr-only` input, `data-state selected\|unselected` |
| `FeatureCarousel` (+`.Item`) | `role="tablist"`, ok tuşlarıyla gezinme |
| `TipsList` (+`.Item`) | `<ol>` ipucu listesi |
| `useOnboarding()` | context erişimi |

**Değerlendirme:** bileşen bir **ilk açılış sihirbazı** (karşıla → kişiselleştir → ipuçları, dialog içinde,
doğrusal İleri/Geri). Bizim ihtiyacımız ise **ziyaretler boyunca yaşayan bir kurulum kontrol listesi**:
adım başına "tamamlandı" durumu, kalıcılık, atlama, sıradan bağımsız ilerleme — bunların hiçbiri
bileşende yok. Ayrıca alt adım yalnız 1. adıma sabit kodlanmış ve dokümandaki render-prop `Step` kaynakta yok.

**Alınan:** compound API iskeleti + `data-slot` kancaları + controlled state (`useControllableState`),
`StepIndicator` (`pills`), `ChoiceGroup` (ileride dönem seçimi için).
**Değiştirilen:** Root semantiği checklist'e (bkz. §6.3), `Step` akordeon öğesine (unmount yerine yükseklik
geçişi), `Navigation` adım başına CTA'ya.
**Atılan:** `FeatureCarousel`, `TipsList`, `Header`'ın serif başlığı.

**DESIGN.md çelişkileri (çevrilecek):**

| cult-ui | Flowventory |
| --- | --- |
| Root `rounded-xl border p-6 shadow-sm bg-background` | `rounded-lg border border-hairline bg-card`, gölge yok |
| Başlık `font-serif text-3xl font-normal` ortalı | `PageHeader` h1 `text-2xl font-semibold tracking-tight`, kart başlığı `text-sm font-medium` |
| Buton `rounded-xl py-5 bg-foreground` | `Button` varyantları (`default` ink, `outline`, `ghost`), `rounded-md` |
| Nokta `transition-all duration-200` | `transition-colors duration-150`; hap morph `layoutId` + `SPRING` |
| Seçim `border-primary/30 bg-primary/10` | hairline → `border-ring` + ink; mavi yok |
| Dot tonları `foreground/60`, `muted-foreground/30` | mevcut dil: aktif `bg-foreground` hap, tamam `bg-muted-foreground`, bekliyor `bg-hairline` |

### 2.2 Emsaller

| Ürün | Yerleşim | İlerleme / tamamlanma | Gizleme | Plan/ödeme |
| --- | --- | --- | --- | --- |
| **Shopify Polaris "Setup guide"** | App Home kartı **ya da ayrı onboarding sayfası** | "X / Y adım tamamlandı", akordeon adımlar: onay kutusu + başlık + açıklama + görsel + tek aksiyon | X + daralt | Ayrı, Shopify'ın barındırdığı plan sayfası |
| **Shopify admin ana sayfa** | Ana sayfada kontrol listesi | Kalan sayısı; **ürün olayıyla otomatik tamamlanır**, sonraki eksik adım kendiliğinden açılır | Evet | Ankete göre kişiselleşir |
| **Stripe dashboard** | Ana sayfaya gömülü liste, her öğe ayar sayfasına derin link | Tamamlanana kadar kalıcı, otomatik | Bitene kadar yok | Hesap aktivasyonu bir adım |
| **Linear** | Tam ekran sıralı adımlar | İlerleme çubuğu yok, demo veri hazır | İsteğe bağlı her adım atlanabilir | Onboarding dışında |
| **Loom** | Ana sayfa listesi | İlk öğe **önceden işaretli** (bağışlanmış ilerleme) | **Atlanamaz** → kullanıcı kaybı vakası | Değer (AI özet) önce, upsell sonra |
| **Notion** | Sidebar'da gerçek bir "Getting Started" sayfası | Sayfa içi onay kutuları (manuel) | Sayfa silinebilir | — |
| **Clerk / Resend** | Rehberli 3–4 adım, aktif adım vurgulu | SDK/anahtar/DNS **olaydan otomatik** | — | — |
| **Vercel** | İlk gün ücretli plan dayatılmaz | — | — | Pro 14 gün deneme, doğal iş birliği anında |

### 2.3 Çıkarılan ilkeler

1. **≤ 5 adım.** Shopify: "beşten fazla adım terk ettirir"; Appcues: 5+ maddeli listelerde tamamlama belirgin düşer.
2. **Tamamlanma gerçek olaydan, otomatik.** Sayfa ziyareti değil ürün olayı (Appcues; Shopify admin).
3. **Adım = eylem + tek CTA + derin link.** "Stok eşiklerini ayarla", "Eşikler hakkında bilgi al" değil.
4. **İlerleme görünür, sonraki eksik adım kendiliğinden açılır** (Shopify, Stripe).
5. **Atla/ertele serbest, gerçek arayüz asla kilitlenmez** (Shopify; Loom karşı örneği; NN/g: itilen
   tutorial performansı artırmaz).
6. **Bitince onboarding arayüzü kalkar, gizlenen geri gelmez** (Built for Shopify 4.2.2 / 4.3.6).
7. **Ana ekran "kurulu ve çalışıyor" demeli** (BfS 4.2.3) → tamamlanma durumu bir mesajla biter.
8. **Değer önce, ödeme sonra; deneme süresinde animasyonlu geri sayım yok** (BfS 4.3.2). Kalan gün statik metin.
9. **Tamamlanmayı kutla — ölçülü.** Adım başına küçük tik animasyonu; konfeti yok (data-ink dili).

## 3. ikas faturalandırma modeli

ikas MCP `list` + `introspect` ile doğrulandı (27 Eyl 2026) + builders.ikas.com "plans" dokümanı.

| Parça | Ayrıntı |
| --- | --- |
| Plan tanımı | Partner panel › Uygulama › Planlar. Plan başına ad, değişmez **key**, para birimi (TRY/EUR/USD), aylık/yıllık fiyat (KDV hariç). **TR bölgesinde yalnız yıllık plan.** Bölge başına ≤4 ücretli (ya da 1 ücretsiz + 3 ücretli); denemeli plan bölge başına bir tane. |
| Fiyatlama | Mağazaya gösterilen = `(kalan ikas lisans günü / 365 × yıllık ücret) + KDV` — oranlanır. |
| Deneme | **ikas tutmaz.** Uygulama kurulum tarihini kendisi saklar ve süreyi kendisi uygular. |
| `getMerchantLicence` (query) | `appSubscriptions[] { storeAppListingSubscriptionKey, status: ACTIVE\|WILL_BE_REMOVED\|REMOVED, deleted, lastPaymentDate, lastPaymentPeriod, lastPaymentPeriodInDays, lastPaymentPriceWithTax, currency, … }`. **Hak = `status === 'ACTIVE' && !deleted`** ve key bizim planımız. Tek doğruluk kaynağı. |
| `createMerchantAppPayment` (mutation) | `input { storeAppListingSubscriptionKey }` → `MerchantAppPayment { id, merchantPaymentUrl, status: WAITING_FOR_PAYMENT\|PAID\|PAYMENT_FAILED, type, prices[] }`. |
| Ödeme ekranı | İstemci: `AppBridgeHelper.startMerchantPayment(paymentId)` (`@ikas/app-helpers@1.0.10`). **Resmi dokümanda anlatılmıyor — ikas'a teyit edilecek.** Dokümante yol: ikas çerçevesinin sağ üstündeki **"Planı Yönet"** butonu. |
| Webhook `store/app/payment` | Yalnız Partner panel "Bildirim Adresi"ne gelir; `saveWebhooks` bu scope'u reddeder. Yalnız `status === 'PAID'` işlenir, ardından `getMerchantLicence` ile uzlaştırılır. SDK 2.0.11 ile 2.1.0 arasında yük şekli farklı. |
| `getAvailableSubscriptions` | Canlı şemada var, **ikas MCP listesinde yok** → CLAUDE.md gereği kullanılmaz. Tek plan olduğundan ad/fiyat/özellik yerel config'den gelir. |
| Uninstall | `store/app/deleted` tüm merchant verisini siler (`MerchantSettings` dahil). Deneme kaydı ayrı modelde ve **silinmeden** tutulmalı; yoksa kaldır-kur ile deneme sonsuza uzar. Saklanan yalnız `merchantId` + tarihler (kişisel veri yok). |

## 4. Bilgi mimarisi

```
Sidebar nav                         Rota
─────────────────────────────       ──────────────────────────
● Başlarken            2/4   ◄──── /dashboard/baslarken   (yeni, emekli olana dek)
  Genel Bakış                       /dashboard
  Stok Takibi                       /dashboard/stok
  Satın Alma                        /dashboard/rapor
  Analiz                            /dashboard/analiz
  Kurallar                          /dashboard/kurallar
  Ayarlar                           /dashboard/ayarlar   → #plan "Plan ve abonelik" (kalıcı ev)
```

- **Nav satırı** listenin en üstünde. Sağında `SidebarMenuBadge` (mono `text-[10px] tabular-nums`):
  - kurulum eksik → `2/4`
  - kurulum tamam, abone değil → `Deneme` (deneme bittiyse `Bitti`, `text-destructive` değil — rozet nötr kalır, durum sayfada)
  - ikon modunda rozet gizli; tooltip "Başlarken · 2/4".
- **Emeklilik (satır kaybolur):** (kurulum tamam **ya da** rehber gizlendi) **ve** abonelik `active`.
  Abone olmayan mağaza için satır kalır — plan yolunun görünür olması gerekir (preflight: "yolu göster").
- **Sidebar kartı kalkar** (`OnboardingCard.tsx` silinir). Footer: bildirim zili, geri bildirim, mağaza adı.
- **Ayarlar `#plan`** bölümü aboneliğin kalıcı evidir; rehber emekli olduktan sonra da görünür.
- **İlk açılış:** kurulumdan sonraki ilk girişte, rehber tamamlanmadıysa `/dashboard/baslarken`'e düşer
  (tek sefer, `flowventory:onboarding-landed`). Sonraki girişler Genel Bakış'tan başlar.

## 5. Ekran tasarımı

### 5.1 Başlarken sayfası — kurulum sürüyor, deneme süresinde

```
┌ PageContainer ──────────────────────────────────────────────────────────────┐
│ KURULUM                                                                      │
│ Başlarken                                              [ Rehberi gizle ]     │
│ Flowventory'yi mağazana bağla, eşikleri belirle, ilk raporunu al.            │
│                                                                              │
│            ┌ max-w-3xl ────────────────────────────────────────────────┐    │
│            │ Kurulum rehberi                        2 / 4 TAMAMLANDI    │ h-12│
│            │ ▬▬▬▬ ▬▬▬▬ ████ ▭▭▭▭                                        │    │
│            ├────────────────────────────────────────────────────────────┤    │
│            │ (✓) Mağaza verini senkronla                           ⌄    │    │
│            ├────────────────────────────────────────────────────────────┤    │
│            │ (✓) Takip scriptini kur                               ⌄    │    │
│            ├────────────────────────────────────────────────────────────┤    │
│            │ (3) Stok eşiklerini ayarla                            ⌃    │    │
│            │     Hangi stok seviyesinin "kritik", hangisinin "az        │    │
│            │     kalan" sayılacağını belirle. Uyarılar, kurallar ve     │    │
│            │     satın alma önerileri bu eşiklere göre çalışır.         │    │
│            │     [ Eşikleri ayarla → ]   [ Varsayılanı kullan (5/10) ]  │    │
│            ├────────────────────────────────────────────────────────────┤    │
│            │ (4) Satın alma raporunu incele                        ⌄    │    │
│            └────────────────────────────────────────────────────────────┘    │
│                                                                              │
│            ┌ Abonelik ──────────────────────────────── [DENEME] ───────┐    │
│            │ Deneme süren 12 Ekim'de bitiyor · 9 gün kaldı              │    │
│            │                                                            │    │
│            │ Flowventory                                   ₺X / yıl     │    │
│            │                                               + KDV  (i)   │    │
│            │ ✓ Stok takibi ve uyarılar    ✓ Satın alma raporu           │    │
│            │ ✓ Otomatik kurallar          ✓ E-posta özetleri            │    │
│            │                                                            │    │
│            │ [ Aboneliği başlat ]                                       │    │
│            │ Ödeme ikas üzerinden alınır; dilersen sağ üstteki          │    │
│            │ "Planı Yönet" butonunu da kullanabilirsin.                 │    │
│            └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- `(i)` = `InfoTip`: "Fiyat, ikas lisansının kalan gününe göre oranlanır."
- Tek kolon, kural oluşturucu emsali `mx-auto max-w-3xl`; container yine `PageContainer`.
- Kurulum kartı = `TableSection` iskeleti dilinde: başlık şeridi `h-12 border-b`, satırlar `divide-y divide-hairline`.
- Mavi yalnız "Planı Yönet" gibi metin içi linkte. Tüm butonlar ink/outline/ghost.

### 5.2 Adım satırı anatomisi

```
kapalı   (n) Başlık                                             ⌄      py-3 px-5, tüm satır buton
açık     (n) Başlık                                             ⌃
             Açıklama (text-sm text-muted-foreground, max 2-3 satır)
             [Birincil CTA →] (Button default, derin link)  [İkincil] (ghost, ops.)
tamam    (✓) Başlık (muted + line-through)                      ⌄      açılırsa "Tekrar aç" linki
```

- Rozet `size-5 rounded-full`: bekliyor `border-hairline bg-card text-muted-foreground` + numara;
  tamam `bg-success text-success-foreground` + tik (yeşil yalnız burada — mevcut kart kuralı).
- Satır `aria-expanded`, içerik `role="region"` + `aria-labelledby`; klavyede ↑/↓ satırlar arası, Enter/Space aç-kapa.
- Aynı anda tek adım açık (akordeon). Tamamlanmış adıma tıklanırsa yine açılır (CTA "Tekrar aç").

### 5.3 Adımlar

| # | key | Başlık | Açıklama (kısa) | Birincil CTA → | İkincil | Tamamlanma (kaynak) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `sync` | Mağaza verini senkronla | Ürünler, stoklar ve satışlar ikas'tan çekilsin. | Ayarlar `#veri-senkron` | — | **Sunucu:** `SyncLog` `type:'full', status:'success'` var |
| 2 | `tracker` | Takip scriptini kur | Ürün görüntülenmeleri toplansın; "çok bakılıp az satan" analizi açılsın. | Ayarlar `#takip-scripti` (yeni anchor) | — | **Sunucu:** `TrackingScriptInstall` satırı |
| 3 | `threshold` | Stok eşiklerini ayarla | Kritik / az kalan seviyeleri; uyarılar ve raporlar buna göre çalışır. | `/dashboard/stok` (eşik kontrolü) | Varsayılanı kullan (5/10) | **Sunucu:** `MerchantSettings` varsayılandan farklı **veya** istemci `threshold-confirmed` |
| 4 | `report` | Satın alma raporunu incele | Tedarikçi bazlı sipariş önerilerini gör. | `/dashboard/rapor` | — | İstemci: `flowventory:report-viewed` (mevcut) |

Abonelik rehberde 5. adım **değil**, ayrı karttır: denemedeki mağazanın kurulumu "bitmemiş" görünmesin,
ödeme bir kurulum şartına dönüşmesin (ilke 8).

### 5.4 Tamamlanma durumu

```
┌ Kurulum rehberi ─────────────────────────── 4 / 4 TAMAMLANDI ┐
│ (✓) Kurulum tamam — Flowventory stoklarını izliyor.           │
│     Uyarılar ve öneriler Genel Bakış'ta.  [ Genel Bakış'a git ]│
│     Adımları göster ⌄                                          │
└────────────────────────────────────────────────────────────────┘
```

Son adım bitince 900ms "done beat" (tik okunur) → liste yükseklik geçişiyle tamamlanma satırına çöker.

### 5.5 Abonelik kartı durumları

| Durum | Rozet (`Badge`) | Gövde | CTA |
| --- | --- | --- | --- |
| `trial` | `info` "Deneme" | "Deneme süren {tarih}'de bitiyor · N gün kaldı" (statik) + plan satırı + özellikler | **Aboneliği başlat** |
| `pending` | `neutral` "Ödeme bekleniyor" | "ikas ödeme ekranı açıldı. Ödeme tamamlanınca burası güncellenir." + tek skeleton satır | Tekrar dene · "Planı Yönet" ipucu |
| `active` | `success` "Aktif" | "Yıllık plan · sonraki yenileme {lastPaymentDate + dönem}" | — (yönetim ikas'ta; metin içi link) |
| `will_be_removed` | `warning` "Dönem sonunda bitecek" | "{tarih} sonrası erişim kapanır." | Aboneliği yenile |
| `expired` | `critical` "Deneme bitti" | "Verilerin saklanıyor; devam etmek için aboneliği başlat." | **Aboneliği başlat** |

- `pending`: 5 sn aralıkla en çok 2 dk `GET /api/ikas/subscription` yoklanır; pencere odağı dönünce bir kez daha. Süre dolarsa `trial`/`expired`'a döner + "Ödeme tamamlandıysa birkaç dakika içinde görünür" notu.
- Hata (`createMerchantAppPayment` / bridge başarısız) → `toast.error` + kartta "Planı Yönet" ipucu; sessiz başarısızlık yok.

### 5.6 Deneme bitti — kilit ekranı

`expired` (ya da `REMOVED`) durumda dashboard layout'u Başlarken ve Ayarlar **dışındaki** sayfalarda içerik
yerine tek ekran gösterir: `EmptyState` dili, başlık "Deneme süren bitti", açıklama "Stok verilerin ve
kuralların saklanıyor. Aboneliği başlatınca kaldığın yerden devam edersin.", CTA "Aboneliği başlat"
(→ `/dashboard/baslarken#abonelik`). Sidebar açık kalır; sessiz 403 yok. Sunucu tarafı ağır uçlar
(rapor, analiz, kural değerlendirme cron'u) aynı `resolveSubscriptionState` ile korunur (§8 Faz 4).

### 5.7 Ayarlar `#plan`

`SettingsSection` ("Plan ve abonelik" / "Mevcut planın ve deneme durumu."), sağ kolonda §5.5 kartının
kompakt hali (rozet + tek satır durum + CTA). Rehber emekli olduktan sonra planın tek uygulama içi yeri.

### 5.8 Dar ekran (iframe < 768px)

Kurulum kartı ve abonelik kartı tam genişlik; adım CTA'ları alt alta (`flex-col sm:flex-row`); başlık
şeridindeki "2 / 4 TAMAMLANDI" pill göstergesinin altına iner. Rehberi gizle butonu `PageHeader` actions'ta kalır.

## 6. Veri modeli ve API sözleşmeleri

### 6.1 Prisma

```prisma
// Deneme süresi — uninstall purge listesine EKLENMEZ (kaldır-kur ile sıfırlanmasın).
model AppTrial {
  id         String   @id @default(cuid())
  merchantId String   @unique
  startedAt  DateTime @default(now())
  endsAt     DateTime
  createdAt  DateTime @default(now())
}
```

- OAuth callback'te `upsert` — **varsa dokunulmaz** (`update: {}`).
- Mevcut kurulumlar için tek seferlik doldurma: migration SQL'inde `AuthToken.createdAt`'ten
  `startedAt`, `+ trialDays` → `endsAt` (lansman öncesi kurulanlara lansman tarihinden başlatmak ayrı karar — §10).
- Abonelik durumu **saklanmaz**; her istekte `getMerchantLicence`'tan okunur (kısa süreli bellek cache'i
  yeterli). Webhook yalnız cache'i geçersiz kılar + bildirim üretir.

### 6.2 Config ve saf fonksiyonlar

```ts
// src/lib/billing/plan.ts
export const PLAN = {
  key: process.env.IKAS_PLAN_KEY,    // Partner panelde deploy'da oluşturulur; boşsa faturalandırma kapalı
  name: 'Flowventory',
  yearlyPrice: 980,                   // TL, KDV hariç; gösterim amaçlı (ikas oranlar)
  currency: 'TRY',
  trialDays: 14,
  features: ['Stok takibi ve uyarılar', 'Satın alma raporu', 'Otomatik kurallar', 'E-posta özetleri'],
} as const;

// src/lib/billing/entitlement.ts — saf, vitest'li
export type SubscriptionState = 'trial' | 'active' | 'will_be_removed' | 'expired';
export function resolveSubscriptionState(input: {
  subscriptions: ReadonlyArray<{ key: string; status: 'ACTIVE' | 'WILL_BE_REMOVED' | 'REMOVED'; deleted: boolean }>;
  trialEndsAt: Date | null;
  now: Date;
}): SubscriptionState;
```

**Faturalandırma kapalı modu (`IKAS_PLAN_KEY` boş):** plan Partner panelde gerçek deploy'da
oluşturulacağı için kod anahtarsız da tutarlı çalışır — `resolveSubscriptionState` `billingEnabled: false`
girdisiyle **hiç `expired` döndürmez** (anahtar yokken kimse ödeme yapamaz; kilitlemek yolsuz kilit olur).
Kart deneme bilgisini gösterir, "Aboneliği başlat" yerine "Abonelik yakında açılıyor" notu çıkar, checkout
ucu 503 döner, kilit ekranı devre dışıdır. Deneme sayacı yine `AppTrial`'dan işler; anahtar girildiği an
normal akış başlar (denemesi dolmuş mağaza doğrudan `expired` görür — lansmanda A5 kararı bunu yumuşatır).

Öncelik: bizim key'imizde `ACTIVE && !deleted` → `active`; `WILL_BE_REMOVED && !deleted` → `will_be_removed`;
yoksa `now < trialEndsAt` → `trial`; değilse `expired`.

### 6.3 Onboarding bileşeni (cult-ui uyarlaması) — hedef API

```tsx
<Onboarding
  steps={steps}                 // { key, done }[]
  value={openKey}               // açık adım (controlled; useControllableState)
  onValueChange={setOpenKey}
  onComplete={handleComplete}   // tüm adımlar done olduğunda bir kez
>
  <Onboarding.Header>            {/* başlık şeridi: başlık + sayaç */}
    Kurulum rehberi <Onboarding.Progress />   {/* "2 / 4 TAMAMLANDI" */}
  </Onboarding.Header>
  <Onboarding.StepIndicator variant="pills" />
  <Onboarding.Step step="sync" title="Mağaza verini senkronla">
    <Onboarding.StepDescription>…</Onboarding.StepDescription>
    <Onboarding.StepActions>
      <Button asChild><Link href="/dashboard/ayarlar#veri-senkron">Senkronla</Link></Button>
    </Onboarding.StepActions>
  </Onboarding.Step>
  …
</Onboarding>
```

`data-slot` kancaları korunur (`onboarding`, `onboarding-step`, `onboarding-step-indicator`, …).
Alan dışı: `FeatureCarousel`, `TipsList`, doğrusal `Navigation`. `ChoiceGroup` dosyada kalır (kullanılmaz).

### 6.4 API uçları

| Uç | Kaynak | Yanıt |
| --- | --- | --- |
| `GET /api/onboarding/status` | prisma: `SyncLog`, `TrackingScriptInstall`, `MerchantSettings` | `{ data: { sync: boolean, tracker: boolean, threshold: boolean } }` |
| `GET /api/ikas/subscription` | `getMerchantLicence` + `AppTrial` + `PLAN` | `{ data: { state, trialEndsAt, daysLeft, renewsAt, plan: { name, yearlyPrice, currency, features } } }` |
| `POST /api/ikas/subscription/checkout` | `createMerchantAppPayment({ storeAppListingSubscriptionKey: PLAN.key })` | `{ data: { paymentId } }` (ödeme URL'i ve token yanıtta/logda yok) |
| Webhook `store/app/payment` | `src/app/api/ikas/webhook/route.ts` switch | yalnız `PAID` → cache geçersiz + uygulama içi bildirim "Aboneliğin aktif" |

Hepsi `getUserFromRequest` → `AuthTokenManager.get` → `getIkas`; GraphQL belgeleri
`graphql-requests.ts`'e + `pnpm codegen`; route dosyasından yardımcı export yok.

İstemci: `ApiRequests.onboarding.getStatus(token)`, `ApiRequests.subscription.get(token)`,
`ApiRequests.subscription.checkout(token)`; `useSubscription()` hook'u `src/lib/billing/use-subscription.ts`
(onboarding.ts deseninde: modül düzeyi cache + `CHANGE_EVENT`, sidebar ve sayfa aynı veriyi paylaşır).

## 7. Hareket

Tüm değerler [src/lib/motion.ts](../../src/lib/motion.ts)'ten; elle spring/eğri yazılmaz.

| Öğe | Hareket |
| --- | --- |
| Adım aç/kapa | yükseklik `auto` geçişi `SPRING` (350/35), içerik opacity 150ms; reduced-motion → `INSTANT` |
| Rozet numara ↔ tik | mevcut kartın hareketi aynen: `AnimatePresence mode="popLayout"`, scale 0.8↔1 + opacity, `SPRING` |
| StepIndicator aktif hap | `layoutId` + `SPRING` (mevcut `onboarding-active-dot` dili); reduced-motion'da anlık |
| Done beat | 900ms bekleme (zamanlama, harekette değil — reduced-motion'da da korunur) → sonraki eksik adım açılır |
| Tamamlanma | liste yükseklik çöküşü `SPRING`, tamamlanma satırı 150ms opacity; konfeti yok |
| Nav rozeti sayı | `AnimatedNumber` (yön farkındalıklı kayma) |
| Nav satırı emekliliği | satır opacity 150ms + yükseklik 200ms `EASE_OUT` (çıkış girişten sessiz) |
| Sayfa ilk boyama | `animate-enter` yalnız iki kartta (80ms stagger); state değişiminde yeniden tetiklenmez |
| Basma | `Button` yerleşik; satır butonu `PRESS_FEEDBACK_CLASS` |

## 8. Uygulama planı (fazlar)

Her faz ayrı commit (Conventional Commits, `feat(onboarding): …` / `feat(billing): …`).

**Faz 0 — Bileşen tabanı**
- cult-ui `onboarding.tsx` GitHub raw'dan indirilir → `src/components/ui/onboarding.tsx`; §2.1 tablosuna ve §6.3 API'sine göre çevrilir.
- Nav ikonu: heroicons-animated setinde uygun ikon yok → kullanıcıdan `rocket-launch` / `flag` / `check-badge` istenir; gelene kadar `check.tsx`.

**Faz 1 — Onboarding durumu sunucuda**
- `src/app/api/onboarding/status/route.ts` + `ApiRequests.onboarding`.
- `src/lib/onboarding.ts`: `useOnboardingSteps` sunucu ucuna geçer; `mark*` + `CHANGE_EVENT` iyimser güncelleme + refetch olarak kalır; localStorage anahtar literal'leri değişmez. `confirmDefaultThreshold()` eklenir. Ayarlar'da takip scripti bölümüne `id="takip-scripti"`.
- Vitest: adım türetme + rozet/emeklilik görünürlüğü saf fonksiyonları.

**Faz 2 — Başlarken sayfası + nav**
- `src/app/dashboard/baslarken/page.tsx`, `_components/SetupGuide.tsx`, `_components/SubscriptionPanel.tsx` (abonelik kartı bu fazda yalnız iskelet; gerçek veri Faz 3'te bağlanır).
- `AppSidebar.tsx`: `OnboardingCard` kaldırılır, "Başlarken" nav öğesi + `SidebarMenuBadge`.
- `OnboardingCard.tsx` silinir; `SidebarFeedback.tsx` yorumu ve `AnimatedCheckbox.tsx` referans yorumu güncellenir.

**Faz 3 — Abonelik altyapısı**
- Prisma `AppTrial` + migration (`prisma migrate diff`; local `DATABASE_URL` boş) + OAuth callback upsert.
- `graphql-requests.ts`: `getMerchantLicence`, `createMerchantAppPayment` → `pnpm codegen`.
- `src/lib/billing/{plan,entitlement,use-subscription}.ts` + vitest (`resolveSubscriptionState` tüm dallar).
- `GET/POST /api/ikas/subscription(/checkout)`; istemcide `AppBridgeHelper.startMerchantPayment`.
- Webhook `store/app/payment` (yalnız `PAID`). Kullanıcı adımı: Partner panelde plan + Bildirim Adresi.

**Faz 4 — Kapı, Ayarlar, ilk açılış**
- `src/app/dashboard/layout.tsx` kilit ekranı (§5.6); ağır API uçlarında sunucu kontrolü.
- Ayarlar `#plan` bölümü (§5.7).
- İlk açılış yönlendirmesi `/dashboard/baslarken`.

**Faz 5 — Dokümantasyon**
- DESIGN.md §5 "Sidebar onboarding kartı" → "Başlarken rehberi" + "Abonelik kartı"; §6 onboarding kartı referansları ve slayt motifi emsali (başka kullanım yoksa motif maddesi kaldırılır).
- DEVIR-NOTLARI §J (onboarding QA; "3 adım" → güncel), §4.6/§4.7 durum; IKAS-PREFLIGHT-RAPORU plan satırı.
- Bu belgenin `> Durum:` satırı "uygulandı" + sapmalar.

### Dosya haritası

| Tür | Dosya |
| --- | --- |
| Yeni | `src/components/ui/onboarding.tsx`, `src/app/dashboard/baslarken/**`, `src/app/api/onboarding/status/route.ts`, `src/app/api/ikas/subscription/route.ts`, `src/app/api/ikas/subscription/checkout/route.ts`, `src/lib/billing/*` |
| Değişen | `src/lib/onboarding.ts`, `src/components/layout/AppSidebar.tsx`, `src/lib/api-requests.ts`, `src/lib/ikas-client/graphql-requests.ts` (+ generated), `prisma/schema.prisma` (+ migration), `src/app/api/ikas/webhook/route.ts`, `src/app/api/oauth/callback/ikas/route.ts`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/ayarlar/**`, `DESIGN.md` |
| Silinen | `src/components/layout/OnboardingCard.tsx` |
| Yeniden kullanılan | `firstIncompleteIndex` / `nextIncompleteIndex`, `SPRING` / `INSTANT` / `EASE_OUT` / `PRESS_FEEDBACK_CLASS`, `PageContainer` / `PageHeader`, `Badge`, `Button`, `InfoTip`, `EmptyState`, `SettingsSection`, `SidebarMenuBadge`, `AnimatedNumber`, `useIconHover`, `TokenHelpers` + `ApiRequests`, `getIkas` + `AuthTokenManager` |

## 9. QA / doğrulama

- **Kapılar:** `pnpm lint`, `pnpm tsc --noEmit`, `pnpm vitest`. `pnpm build` yalnız dev sunucusu kapalıyken.
- **Rehber:** nav rozeti 0/4 → 4/4 canlı; adım tamamlanınca tik + 900ms + sonraki eksik adım açılır; "Varsayılanı kullan" 5/10'da adımı tamamlar; başka tarayıcıda sync/tracker/threshold tamam görünür (sunucu kaynağı); "Rehberi gizle" → abone değilse nav satırı kalır, aboneyse kaybolur; ikon modunda rozet gizli + tooltip; klavye ↑/↓/Enter; reduced-motion; 375px iframe.
- **Abonelik:** `resolveSubscriptionState` fixture'ları (deneme içi/dışı, ACTIVE, WILL_BE_REMOVED, REMOVED, deleted, başka key); checkout hata toast'ı; `pending` yoklaması 2 dk'da durur; webhook `PAYMENT_FAILED`'ı yoksayar; uninstall sonrası `AppTrial` duruyor, yeniden kurulumda deneme sıfırlanmıyor.
- **Canlı ödeme:** ikas test mağazasında, Partner panel plan key'i tanımlandıktan sonra (kullanıcı adımı) — `startMerchantPayment` davranışı burada teyit edilir.
- **DESIGN.md §7** kontrol listesi yeni sayfa için tek tek.

## 10. Açık sorular

| # | Soru | Öneri |
| --- | --- | --- |
| A1 | Yıllık fiyat (TRY, KDV hariç)? | ✅ 980 TL |
| A2 | Deneme kaç gün? | ✅ 14 gün |
| A3 | Partner panel plan key'i | ✅ Gerçek deploy'da oluşturulur → Vercel env `IKAS_PLAN_KEY`; o zamana dek faturalandırma kapalı modu |
| A4 | `AppBridgeHelper.startMerchantPayment` uygulama içinden destekleniyor mu? | ikas'a sor; desteklenmiyorsa CTA yalnız "Planı Yönet" yönlendirmesi olur |
| A5 | Lansman öncesi kurulumların denemesi ne zaman başlasın? | Lansman tarihinden (mevcut kullanıcı cezalandırılmasın) |
| A6 | Deneme bitince kilit kapsamı | Başlarken + Ayarlar açık, diğer sayfalar kilit ekranı; veriler silinmez |
| A7 | Nav ikonu | ✅ `@heroicons-animated/rocket-launch` (hover 300ms tek seferlik kalkışa çevrildi; upstream sonsuz döngüydü) |

## Kaynaklar

- cult-ui: [onboarding.tsx](https://raw.githubusercontent.com/nolly-studio/cult-ui/main/apps/www/registry/default/ui/onboarding.tsx) · [demo](https://raw.githubusercontent.com/nolly-studio/cult-ui/main/apps/www/registry/default/example/onboarding-demo.tsx) · [registry ui.ts](https://raw.githubusercontent.com/nolly-studio/cult-ui/main/apps/www/registry/ui.ts)
- Shopify: [Setup guide composition](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide) · [Onboarding guidelines](https://shopify.dev/docs/apps/design/user-experience/onboarding) · [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) · [App Store best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices) · [Managed pricing](https://shopify.dev/docs/apps/launch/billing/managed-pricing) · [Candu Shopify teardown](https://www.candu.ai/blog/shopify-onboarding-flow)
- Emsaller: [Stripe](https://www.925studios.co/blog/stripe-dashboard-design-breakdown) · [Linear](https://www.candu.ai/blog/linear-onboarding-teardown) · [Loom](https://productonboarding.com/examples/loom-onboarding-checklist) · [Notion](https://goodux.appcues.com/blog/notions-lightweight-onboarding) · [Mercury](https://productonboarding.com/examples/mercury-product-adoption) · [Clerk](https://clerk.com/docs/getting-started/quickstart/setup-clerk) · [Resend](https://resend.com/docs/create-an-api-key) · [Vercel Pro trial](https://vercel.com/docs/plans/pro-plan/trials)
- İlkeler: [Appcues checklist best practices](https://docs.appcues.com/best-practices/checklist-best-practices) · [Appcues examples](https://www.appcues.com/blog/best-checklist-examples) · [NN/g onboarding tutorials](https://www.nngroup.com/articles/onboarding-tutorials/)
- ikas: [builders.ikas.com — plans](https://builders.ikas.com/docs/app-development/admin-app/plans) · [with-subscription-app örneği](https://github.com/ikascom/ikas-app-examples/tree/main/examples/with-subscription-app) · ikas MCP introspect (`getMerchantLicence`, `createMerchantAppPayment`, `listMerchantAppPayment`)
