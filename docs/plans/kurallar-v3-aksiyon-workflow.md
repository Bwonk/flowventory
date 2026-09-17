# Kurallar v3 — Aksiyon odaklı, aşamalı workflow

> Durum: **uygulandı** (17 Eyl 2026, §8 adım 1–7 ayrı commit'ler; deploy edilmedi). K1/K2/K4/K5 önerilen seçeneklerle onaylandı.
> Plandan sapmalar: `TrackingRuleState.soldOnStageDay` eklendi (tetik günü öncesi satış düşülür); `email_vendor` (v3.1) eklenmedi;
> "Geri al" önceki mutlak değeri değil kuralın eklediği farkı geri alır (`POST /api/rules/:id/events/:eventId/undo`);
> stok onayı gövdede `stockWriteConsent` (saklanmaz); "ayarla" modu stoğu azaltmaz.
> Önceki turlar: v1 (Ayarlar'da tek koşullu dialog, 16 Eyl) → v2 (ayrı Kurallar sayfası, tip/alan menüsü,
> düz VE/VEYA, tek kanal, 17 Eyl — commit `0f2fb82`, `bb455f3`, `1ac908b`). v2 yayında:
> https://flowventory-khaki.vercel.app (ikas panelinden açılır).

## 1. Neden değişiyor — kullanıcı geri bildirimi (v2 deploy'u sonrası)

1. **Kural tipi e-posta/bildirim olmamalı.** İkisi de bildirim türü. Kural tipi *aksiyonla* ilgili olmalı.
2. **Kural adı iki yerde.** Sol üstte başlıkta yazıyor, solda input'tan değişiyor. İstenen: Notion tarzı —
   başlığın üstüne gelince kalem ikonu, tıklayınca başlık input olur.
3. **Kapsam ve kanal baştan seçilmemeli.** Kanal bir *aksiyon adımı* olarak dinamik workflow'a eklenmeli.
   Örnek (bugün yapılamıyor): "X ürününde stok 10 adet düşerse **bildirim** gelsin; bildirimden sonra
   **3 tane daha** düşerse **e-posta** gelsin."
4. **Sol panel göze batıyor, ihtiyaç yok.** Ayrıca VE/VEYA tek seçim olmamalı; **eklenen her koşulun kendi
   bağlacı** olmalı.
5. **Kuram:** kurallar bir *bildirim aracı* değil **aksiyon aracı**. Ne zaman çalışacakları kestirilemediği
   için kullanıcıyı bilgilendirmek üzere bildirim de akışa dahil edilir. Örnek: "adet 10'a düştüyse bildirim
   gönder **ve stoğu 5 artır**."
6. **Kural şablonları:** 2-3 hazır şablon sunulsun.

## 2. Hedef kavram

```
Kural = Tetikleyici (hangi ürünler) → Aşama 1 → Aşama 2 → …
Aşama = Koşullar (koşul başına VE/VEYA) → Aksiyonlar (1..n: bildirim, e-posta, stok artır, …)
```

- **Tetikleyici**: kapsam (tüm ürünler / ürün / tedarikçi). Kartın *içinde* düzenlenir, varsayılan "Tüm ürünler".
- **Aşama (stage)**: koşullar sağlanınca aksiyonları çalıştırır. Sonraki aşama yalnız önceki aşama o ürün
  için *tetiklendikten sonra* değerlendirilir ve "o andan beri" ölçen koşulları kullanabilir (eskalasyon).
- **Aksiyon**: bildirim ve e-posta artık kural özelliği değil, aksiyon kataloğunun iki elemanı. Yanlarına
  gerçek aksiyonlar gelir (stok artır, tedarikçiye sipariş e-postası…).
- **Alan (stok / satın alma / analiz)** baştan seçilmez; koşul seçicide *grup başlığı* olur. Bir kuralda
  farklı alanlardan koşul karışabilir (v2'deki "alan dışı metrik" kısıtı kalkar).

## 3. Kararlar (öneri) ve yeni sohbette teyit edilecekler

| # | Konu | Öneri | Alternatif |
|---|---|---|---|
| K1 | Koşul başına bağlaç önceliği | Standart: **VE, VEYA'dan önce bağlanır** (A ve B ya da C = (A∧B)∨C). UI, VE zincirlerini ince çerçeveyle kümeleyerek gösterir; parantez/gruplama UI'ı yok | Soldan sağa düz değerlendirme (sürpriz üretir) |
| K2 | Aşama ilerlemesi | Ürün başına durum: aşama *n* tetiklenince `TrackingRuleState` o ürünü aşama *n+1*'e taşır ve o anki stoğu/satışı kaydeder. Aşama 1 koşulu artık sağlanmıyorsa ya da `resetHours` dolduysa başa döner | Tüm aşamaları bağımsız kural gibi değerlendirmek (kullanıcının "sonra" semantiğini karşılamaz) |
| K3 | "Sonra 3 tane daha" metriği | Yeni koşul `stock_drop_since_stage` (önceki aşamanın tetiklendiği andaki stoğa göre düşüş) + `sales_since_stage`. Yalnız aşama ≥ 2'de seçilebilir | Genel `stock_drop` penceresiyle yaklaşıklamak (yanlış sonuç verir) |
| K4 | Stok yazan aksiyonun kapsamı | Kural **varyant düzeyinde** değerlendirilir (aksiyon `adjust_stock` içeriyorsa zorunlu). Yazım hedefi: varyantın ilk deposu (`/api/ikas/quick-stock` ile aynı kural) | Ürün düzeyinde kalıp "stoğu en düşük varyant"a yazmak (belirsiz) |
| K5 | Stok aksiyonu güvenliği | Kural başına `maxRunsPerDay` (varsayılan 1/ürün), adım başına en fazla +1.000, her yazım `TrackingRuleEvent`'e işlenir ve **zorunlu** bilgilendirme bildirimi üretir ("Kural X stoğu 10 → 15 yaptı · Geri al"). Oluşturucuda açık uyarı + ilk kayıtta onay | Onaysız sessiz yazım (reddedilmeli) |
| K6 | "Yeni kural" girişi | Menü: **Boş kural** + 3 şablon. v2'deki tip/alan alt menüsü kalkar | — |
| K7 | Oluşturucu yerleşimi | **Tek kolon** kanvas, `max-w-3xl` ortalı. Sol panel kalkar: ad → başlıkta inline; kapsam → tetikleyici kartı; aralık → kanvas altındaki "Çalışma ayarları" satırı; tetik geçmişi → başlıkta "Geçmiş" butonu + Sheet | — |
| K8 | v2 verisinin taşınması | Migration: her v2 kuralı tek aşamalı workflow'a çevrilir (`logic` → tüm bağlaçlar, `channel` → tek aksiyon). Kolonlar düşürülür | — |

**Yeni sohbette ilk iş:** K1, K2, K4, K5'i kullanıcıya `AskUserQuestion` ile teyit et; gerisi rutin.

## 4. Veri modeli

### Prisma (`prisma/schema.prisma`, migration `rule_workflow`)
```prisma
model TrackingRule {
  id, merchantId, name, enabled, scope, targetId, targetLabel   // aynı
  granularity     String   @default("product")   // "product" | "variant" (stok aksiyonu varsa variant)
  workflowJson    String   @default("{\"stages\":[]}")   // RuleWorkflow — bkz. src/lib/rules/types.ts
  cooldownHours   Int      @default(24)           // aynı hedef + aşama için yeniden çalışma aralığı
  resetHours      Int      @default(168)          // aşama ilerlemesi bu süre sonunda başa döner
  maxRunsPerDay   Int      @default(1)            // hedef başına; stok aksiyonu emniyeti
  lastTriggeredAt, createdAt, updatedAt
  events TrackingRuleEvent[]   states TrackingRuleState[]
  // DÜŞER: domain, channel, logic, conditionsJson
}

model TrackingRuleEvent {        // + yeni alanlar
  … mevcut alanlar (channel DÜŞER)
  variantId    String?
  stageIndex   Int      @default(0)
  actionsJson  String   @default("[]")   // [{type, ok, detail}] — hangi aksiyon ne yaptı
}

model TrackingRuleState {        // YENİ — aşama ilerlemesi (hedef başına)
  id String @id @default(cuid())
  merchantId String; ruleId String; rule TrackingRule @relation(..., onDelete: Cascade)
  targetKey  String            // productId ya da productId:variantId
  stageIndex Int               // sıradaki değerlendirilecek aşama
  stockAtStage Int             // önceki aşama tetiklendiğinde stok
  soldAtStageKey String        // o günün tarih anahtarı (sales_since_stage için)
  stageFiredAt DateTime
  @@unique([ruleId, targetKey]); @@index([merchantId, ruleId])
}
```
Migration SQL: DDL `prisma migrate diff --from-schema-datamodel <HEAD> --to-schema-datamodel prisma/schema.prisma --script`
ile üretilir (yerelde DB yok — bkz. hafıza notu "Vercel deploy akışı"); ADD ile DROP arasına elle veri dönüşümü:
`workflowJson = {"stages":[{"conditions":[…conditionsJson, her birine op: logic],"actions":[{"type": channel=='email'?'email':'notify'}]}]}`.
Postgres'te `jsonb_agg` + `jsonb_set` ile yazılır; v2'de kayıtlı kural sayısı az (test mağazası), dönüşüm
sonrası `SELECT id, "workflowJson"` ile elle kontrol. Webhook purge listesine `trackingRuleState` eklenir.

### Tipler (`src/lib/rules/types.ts`)
```ts
type ConditionNode = { op: 'and' | 'or'; condition: RuleCondition }   // ilk düğümün op'u yok sayılır
type RuleAction =
  | { type: 'notify' }
  | { type: 'email' }                                   // kayıtlı bildirim adresine
  | { type: 'adjust_stock'; mode: 'increase' | 'set'; amount: number }
  | { type: 'email_vendor' }                            // v3.1 — tedarikçiye sipariş e-postası
type RuleStage = { conditions: ConditionNode[]; actions: RuleAction[] }
type RuleWorkflow = { stages: RuleStage[] }             // 1..3 aşama, aşama başına ≤5 koşul, ≤4 aksiyon
```
`RuleCondition` union'ına eklenecekler: `stock_drop_since_stage {threshold}`, `sales_since_stage {threshold}`
(katalogda `stageOnly: true`).

## 5. Saf katman ve motor

- **`src/lib/rules/catalog.ts`**: `domain` alanı kalır ama yalnız *gruplama* için; `METRICS_BY_DOMAIN` seçicide
  başlık olur. Yeni iki "aşamadan beri" metriği. `RuleTarget`'a `stage?: { stockAtStage, soldSinceStage }`.
- **Yeni `src/lib/rules/logic.ts`** (saf): `evaluateNodes(nodes, results: (string|null)[])` — VE önceliğiyle
  VEYA-of-VE grupları; `groupNodes(nodes)` UI kümelemesi ve `describe` için aynı gruplamayı döner.
  `joinClauses` → `describeNodes` ("A ve B ya da C").
- **Yeni `src/lib/rules/actions-catalog.ts`**: `ACTION_CATALOG { type → {label, hint, icon, input, danger?, describe(a)} }`;
  `describeAction` ("bildirim gönder", "stoğu 5 artır"). Form + cümle + motor tek kaynak (koşul kataloğu deseni).
- **Yeni `src/lib/rules/actions/`** (yürütücüler, DB/ikas dokunur):
  - `notify.ts` → `prisma.notification.create` (type `rule`, `ruleId`, dedupeKey).
  - `email.ts` → toplu: aynı turdaki e-posta aksiyonları tek `sendAlertEmail` çağrısında (mevcut davranış).
  - `adjust-stock.ts` → canlı stok oku (`listProduct`), hedef depo = ilk depo, `saveVariantStocks`,
    `refreshProductSnapshot` (StockHistory'ye düşer), emniyet sınırları (K5). Kalıp: `src/app/api/ikas/quick-stock/route.ts`.
  - Her yürütücü `{ ok, detail }` döner; sonuçlar `TrackingRuleEvent.actionsJson`'a yazılır.
- **`evaluate-rule.ts`**: `evaluateRule(rule, target, state, now)` → `{ stageIndex, body, actions } | null`.
  Aşama `state?.stageIndex ?? 0`; aşama 0 koşulu artık sağlanmıyorsa ya da `resetHours` dolduysa state sıfırlanır.
- **`evaluate.ts`**: imza `evaluateTrackingRules(merchantId, authToken | null, now)` — stok aksiyonu token ister.
  `runFullSync` zaten token'a sahip; cron `getMerchantAuthToken` ile alıyor (`src/lib/rules/run.ts`). Token
  yoksa stok aksiyonu `ok:false, detail:'auth token yok'` olarak işlenir, diğer aksiyonlar çalışır.
  Varyant düzeyi hedefler: `granularity === 'variant'` ise `ProductSnapshot` satırı = hedef.
  Sıra: event create (dedupe) → aksiyonlar → state güncelle → `maxRunsPerDay` sayacı (event tablosundan).
- **Sonsuz döngü notu:** stok aksiyonu → ikas webhook → `refreshProductSnapshot` (kural değerlendirmez) →
  bir sonraki tam sync'te yeniden değerlendirme; cooldown + `maxRunsPerDay` sınırlar.

## 6. API

- `ruleInputSchema` (`src/lib/rules/schema.ts`): `{ name, scope, targetId?, targetLabel?, granularity, workflow, cooldownHours, resetHours, maxRunsPerDay, enabled }`;
  `workflowSchema` (aşama 1..3, koşul 1..5, aksiyon 1..4); superRefine: `*_since_stage` yalnız aşama ≥ 2;
  `adjust_stock` varsa `granularity === 'variant'`; `email`/`email_vendor` varsa bildirim adresi (route'ta 422, mevcut kontrol genişler).
- `GET/POST /api/rules`, `GET/PUT/DELETE /api/rules/[id]` şekil olarak aynı; `TrackingRuleItem` += `workflow`,
  `granularity`, `sentence` (çok aşamalı cümle), `actionSummary` (liste kolonu için: "Bildirim · Stok +5").
- **Yeni `GET /api/rules/templates`** gerekmez — şablonlar istemcide saf sabit (`src/lib/rules/templates.ts`).

## 7. Arayüz

### Liste (`src/app/dashboard/kurallar/page.tsx`, `_components/RulesList.tsx`)
- "Alan" ve "Kanal" kolonları kalkar → **"Aksiyonlar"** kolonu (ikon + kısa etiketler: zil, zarf, kutu+).
- **`NewRuleMenu`**: alt menü yerine düz menü — "Boş kural" + ayraç + şablonlar (ad + tek satır açıklama).
  Rota: `/dashboard/kurallar/yeni` (boş) ya da `?template=<key>`.

### Oluşturucu (`_components/builder/`)
- **Sol panel (`RuleMetaPanel.tsx`) silinir.** Tek kolon: `mx-auto max-w-3xl`.
- **Başlık — Notion tarzı inline düzenleme:** yeni paylaşılan `src/components/shared/EditableTitle.tsx`
  (h1 görünümü; hover'da sağında kalem ikonu `opacity-0 group-hover:opacity-100`; tıkla/Enter → aynı tipografide
  input; Enter/blur kaydeder, Esc geri alır; boşsa placeholder "Adsız kural"; `aria-label`). `PageHeader`'a
  `titleSlot?: ReactNode` eklenir (verilirse `title` yerine çizilir) — `src/components/layout/PageHeader.tsx`.
- **Tetikleyici kartı:** kapsam cümlesi + "Değiştir" → kart içinde açılan satır (SegmentedTrack tüm/ürün/tedarikçi
  + `TargetPicker`). Varsayılan kapalı.
- **Aşama bloğu** (`StageBlock.tsx`): başlık "AŞAMA 1" (tek aşamada başlık gizli) → koşul kartları → aksiyon kartları.
  - Koşul kartları arasındaki bağlaç artık **tıklanabilir rozet** (`ConnectorToggle`: VE ⇄ VEYA, `Badge`
    görünümlü buton). VE zincirleri ince `border-hairline rounded-lg` küme çerçevesiyle gruplanır (K1).
  - Koşul seçicide metrikler alan başlıklarıyla gruplu (Stok Takibi / Satın Alma / Analiz; aşama ≥ 2'de
    en üstte "Önceki aşamadan beri").
  - **Aksiyon kartları** (`ActionCard.tsx`): tip Dropdown (katalogdan), girdiler (stok: artır/ayarla + adet),
    `danger` aksiyonlarda kart içinde uyarı satırı ("ikas admin'deki stoğa otomatik yazar"). "+ Aksiyon ekle".
  - Aşamalar arası bağlantı: `FlowConnector label="SONRA"`; "+ Aşama ekle" (en fazla 3) kesikli kart.
- **Çalışma ayarları satırı** (kanvas altı, tek satır `bg-muted rounded-lg`): yeniden çalışma aralığı,
  (çok aşamalıysa) sıfırlanma süresi, (stok aksiyonu varsa) günlük üst sınır.
- **Önizleme**: kanvasın en altında cümle — "Tüm ürünler için stok 10 adedin altına inerse: bildirim gönder ve
  stoğu 5 artır. Sonra stok 3 adet daha düşerse: e-posta gönder."
- **Geçmiş**: başlık aksiyonlarında "Geçmiş" butonu → `Sheet` (`RuleEventList`), satırda aşama no + aksiyon
  sonuçları (✓/✕ + detay) + stok aksiyonunda "Geri al" (önceki mutlak değeri `update-stock` ile yazar —
  `StockEditor`/`QuickStockButton` kalıbı).
- `use-rule-builder.ts` reducer'ı aşama/koşul/aksiyon eylemleriyle genişler; `initialState(template?)`.
- DESIGN.md §5 "Akış kartları" maddesi güncellenir (aşama, tıklanabilir bağlaç, aksiyon kartı, EditableTitle).

### Şablonlar (`src/lib/rules/templates.ts`, saf)
| Anahtar | Ad | İçerik |
|---|---|---|
| `low-stock-notify` | Stok azalınca haber ver | A1: `stock_below 10` → bildirim |
| `fast-drain-escalate` | Hızlı eriyen ürün: önce bildirim, sürerse e-posta | A1: `stock_drop 10 adet / 24s` → bildirim · A2: `stock_drop_since_stage 3` → e-posta |
| `auto-restock` | Kritik stokta otomatik stok ekle | A1: `stock_below 10` → bildirim + `adjust_stock increase 5` (varyant düzeyi, günlük 1) |
| (ops.) `reorder-email` | Sipariş zamanı gelince e-posta | A1: `reorder_point_reached` → e-posta |

## 8. Uygulama sırası (her biri ayrı commit, kapılar yeşil)

1. `feat(rules)`: tipler + `logic.ts` + `actions-catalog.ts` + şema + describe + testler (saf katman; motor henüz v2 şemasını okur — geçici adaptör yok, 2 ile birlikte merge).
2. `feat(rules)`: Prisma şeması + migration (veri dönüşümü) + `TrackingRuleState` + serialize + motor (`evaluate-rule`, `evaluate`, `actions/*`, `run.ts`, `ikas-sync.ts` çağrısına token) + testler.
3. `feat(rules-api)`: route'lar yeni gövdeye, 422 kontrolleri, `TrackingRuleItem` alanları.
4. `feat(kurallar)`: liste kolonları + `NewRuleMenu` şablonlu + `templates.ts`.
5. `feat(kurallar)`: `EditableTitle` + `PageHeader.titleSlot` + tek kolon oluşturucu (tetikleyici kartı, aşama bloğu, tıklanabilir bağlaç, aksiyon kartları, çalışma ayarları, önizleme); `RuleMetaPanel` silinir.
6. `feat(kurallar)`: Geçmiş Sheet'i + stok aksiyonu "Geri al".
7. `docs`: DESIGN.md + DEVIR-NOTLARI (QA bölümü P).

`pnpm codegen` gerekmiyor: `saveVariantStocks` ve `listProduct` zaten `graphql-requests.ts`'te.

## 9. Testler (vitest, saf)
- `logic.test.ts`: VE önceliği — `A ve B ya da C`, `A ya da B ve C`, tek koşul, hepsi VEYA; `groupNodes` kümeleri.
- `evaluate-rule.test.ts`: aşama ilerlemesi (state yok → A1; A1 sonrası A2 yalnız `since_stage` koşuluyla), reset (A1 koşulu düşünce / `resetHours`), cooldown kovası aşama bazlı.
- `actions-catalog.test.ts` + `describe.test.ts`: çok aşamalı cümle, aksiyon cümleleri.
- `schema.test.ts`: aşama/koşul/aksiyon sınırları, `since_stage` aşama 1'de red, `adjust_stock` ↔ `granularity`.
- `templates.test.ts`: her şablon `ruleInputSchema`'dan geçer.
- `adjust-stock` yürütücüsünün saf kısmı (`computeNewStock(mode, amount, current, limits)`).

## 10. Doğrulama
- `pnpm tsc --noEmit && pnpm lint && pnpm test`; build: **`pnpm exec next build`** (yerelde `pnpm build` migrate adımında DB olmadığı için durur).
- Deploy = `git push origin main` (Vercel build `prisma migrate deploy` çalıştırır); build logunda migration satırı, sonra mevcut kuralların `workflowJson`'u kontrol.
- Tarayıcı (ikas paneli: `https://dev-flowventory.myikas.com/admin/authorized-app/00844ef8-6d08-4acf-8d2d-707e47cd0f81`):
  başlık inline düzenleme (hover kalem, Enter/Esc/blur); şablondan kural; koşul bağlaçlarını tek tek çevirme ve
  küme çerçevesi; iki aşamalı kural (stok düşür → bildirim; 3 daha düşür → e-posta); `auto-restock` şablonu ile
  ikas admin'de stoğun arttığı, zilde "kural stoğu değiştirdi" bildirimi ve Geçmiş'ten "Geri al".

## 11. Riskler
- **Otomatik stok yazımı** en riskli parça: yanlış kural gerçek mağaza stoğunu şişirir. K5 emniyetleri + zorunlu bildirim + geri al + oluşturucuda uyarı şart. Gerekirse bu aksiyon ayrı bir commit/bayrakla en sona bırakılır.
- Aşama durumu (`TrackingRuleState`) değerlendirme sıklığına bağlı: stok geçmişi sync/webhook anlarında yazıldığı için "3 daha düştü" en geç bir sonraki sync/cron turunda (≤1 saat) yakalanır.
- Varyant düzeyi değerlendirme hedef sayısını artırır (ürün × varyant); 50 kural × binlerce varyant için döngü saf ve bellek içi, kabul edilebilir; gerekirse kapsam filtresi önce uygulanır (zaten öyle).
- v2 → v3 migration'ı elle yazılmış JSON dönüşümü içerir; deploy öncesi SQL'i Neon dev branch'inde denemek ideal (yerelde `DATABASE_URL` boş — kullanıcı adımı).

## 12. Açık kalan (bu planın dışında, önceki turlardan)
- DEVIR-NOTLARI.md §N ve §O tarayıcı QA listeleri.
- Örnek özet: Resend anahtarı/domain doğrulandı (test e-postası `delivered`, 17 Eyl); Vercel'deki değerin
  alındığı, ikas panelinden "Örnek özet gönder" ile teyit edilecek. Yereldeki `.env.vercel.local` `CLIENT_SECRET`'i
  production ile aynı değil (eski çekim) — yerelden JWT üretip prod ucu çağırmak bu yüzden çalışmıyor.
- `.env.resend-prod.local` (gitignore'lu) Vercel teyidinden sonra silinebilir.

## 13. Yeni sohbet için başlangıç istemi
> `docs/plans/kurallar-v3-aksiyon-workflow.md` planını uygula. Önce §3'teki K1, K2, K4, K5 kararlarını bana
> sor, sonra §8 sırasıyla ilerle. Mevcut v2 kodu: `src/lib/rules/*`, `src/app/dashboard/kurallar/*`,
> `src/app/api/rules/*`, `prisma/schema.prisma` (TrackingRule, TrackingRuleEvent).
