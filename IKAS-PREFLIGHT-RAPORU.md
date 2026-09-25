# ikas App Preflight — Flowventory (/Users/yigitozen/orca/flowventory)

**Karar:** Düzeltmelerden sonra (bölüm 7) bu kural setine göre koddaki Blocker kalmadı. Açık kalanlar: Partner paneli beyanları (bölüm 3) ve paylaşımlı rate-limit store'u (U11, kısmi).
**Uygulama şekli:** §4 (a) panel içi dashboard (stok, analiz, kurallar, rapor) · **Plan:** ücretsiz (`getMerchantLicence` / `store/app/payment` yok)
**Mod:** tam · **Scanner:** 35 route, 11 client page · **Git:** 2 untracked (`.claude/settings.json`, `RESEND-KURULUM.md`) · Tarih: 2026-09-25 · Skill: ikas-app-preflight 0.3.9 · SDK: admin-api-client 2.0.11, app-helpers 1.0.10

## Bir bakışta
- Flowventory, ikas panelinin içinde çalışan bir stok ve satış analizi uygulaması. Kurulum, giriş ve panel içi yükleme akışı resmi başlangıç şablonuyla aynı ve çalışıyor.
- Kaldırma bildirimi imzalı ve mağazanın tüm verisini siliyor. Ancak vitrine eklenen takip script'ini kaldırmıyor; ikas review'u bunu açıkça bekliyor.
- Script kaldırılmadığı için, uygulama silindikten sonra da müşteri tarayıcılarından sunucuya görüntülenme kaydı yazılmaya devam ediyor.
- Koddaki izin listesinde vitrin ve ürün düzenleme izinleri eksik. Partner panelindeki listenin bunları içerdiği doğrulanmalı.
- Göndermeden önce Partner panelinde iki geliştirme mağazası, Bildirim Adresi ve izin listesi kontrol edilmeli.

## Yapılacaklar (öncelik sırasıyla)
1. **`src/lib/ikas-client/graphql-requests.ts` + `src/app/api/ikas/webhook/route.ts:113`** — `deleteStorefrontJSScript` mutation'ını ekle, `pnpm codegen` çalıştır; `store/app/deleted` dalında veri silinmeden önce mevcut token ile çağır (`not_found` hatası = başarı, hata olsa da temizlik sürsün) → B1 · elle
2. **`src/app/api/track/view/route.ts:54`** — imza doğrulamasından sonra merchant'ın AuthToken satırı yoksa 410/401 dön; kaldırılmış mağazaya yazma olmasın → B1 · elle
3. **`src/globals/config.ts:9`** — scope'a `write_storefronts` ve `write_products` ekle, Partner panel › Uygulama Yetkileri ile eşle → U2 · elle (mevcut kurulumlar yeniden yetki ister)
4. **`src/app/api/oauth/callback/ikas/route.ts:138`** — `after()` içinde takip script'ini otomatik kur (hata kurulumu kırmasın), ya da script'in isteğe bağlı olduğunu listeleme metninde açıkça yaz → U1 · elle
5. **`src/app/api/oauth/callback/ikas/route.ts:111`** — token kaydından önce `getAuthorizedApp.storeAppId === NEXT_PUBLIC_CLIENT_ID` ve `!deleted` kontrolü ekle → U5 · elle
6. **`src/globals/config.ts:12`** — deploy URL'in sonundaki `/` karakterini kırp → U3 · katalogda F4 var
7. **`src/app/api/oauth/authorize/ikas/route.ts:39`** — `state` değerini `randomBytes(32).toString('base64url')` ile üret → U4 · katalogda F3 var
8. **`src/helpers/token-helpers.ts:121`** — iframe içindeyse `router.replace('/dashboard')`, değilse Admin'e yönlendir → U6 · katalogda F5 var
9. **`src/app/callback/page.tsx:26`** — `setToken` çağrısına `.catch(e => { if (e !== 'redirectUrl-called') throw e; })` ekle → U7 · katalogda F6 var
10. **`src/hooks/use-base-home-page.ts:45`** — bridge token var ama backend'de ikas token'ı yoksa `/dashboard` yerine üst pencereden authorize başlat → U8 · elle
11. **`src/app/api/ikas/webhook/route.ts:46`** — gövdeyi zod ile 7 alanlı `IkasWebhook` şemasına göre doğrula → U9 · elle
12. **`src/helpers/jwt-helpers.ts:16`, `src/lib/session.ts:18`** — `|| ''` yerine açılışta env kontrolü (CLIENT_SECRET, 32+ karakter SECRET_COOKIE_PASSWORD) → U10 · elle
13. **`src/app/api/track/view/route.ts:41`** — rate limit'i merchant+IP anahtarına ve paylaşımlı bir store'a taşı → U11 · elle
14. **`src/lib/seed-orders.ts:20`** — inline GraphQL'i `graphql-requests.ts`'e taşı, codegen kullan → U12 · elle
15. **Partner paneli** — 2 dev mağaza, Bildirim Adresi, izin listesi, adresler (bölüm 3) → kod dışında

## Bulgu özeti
```text
#    Şiddet    Alan                          Dosya
B1   review    Kaldırma / storefront script  api/ikas/webhook/route.ts:113
U1   uyarı     Kaldırma / script kurulumu    app/dashboard/ayarlar/_components/TrackingScriptSection.tsx:51
U2   uyarı     OAuth başlatma (eksik scope)  globals/config.ts:9
U3   uyarı     OAuth başlatma (URL)          globals/config.ts:12
U4   uyarı     OAuth başlatma (state)        api/oauth/authorize/ikas/route.ts:39
U5   uyarı     OAuth callback                api/oauth/callback/ikas/route.ts:111
U6   uyarı     Panel içi yükleme             helpers/token-helpers.ts:121
U7   uyarı     Panel içi yükleme             app/callback/page.tsx:26
U8   uyarı     Panel içi yükleme / giriş     hooks/use-base-home-page.ts:45
U9   uyarı     Webhook imzası                api/ikas/webhook/route.ts:46
U10  uyarı     Gizli anahtarlar ve ayar      helpers/jwt-helpers.ts:16
U11  uyarı     Storefront uçları             api/track/view/route.ts:41
U12  uyarı     Backend API                   lib/seed-orders.ts:20
```

## 1. Blocker'lar
**B1 · review · Kaldırma / storefront script (§6.2, §10 #17) `[observed]` R5**
Bulgu: `store/app/deleted` işleyicisi veritabanını temizliyor ama `deleteStorefrontJSScript` çağırmıyor. Takip script'i mağaza vitrininde çalışmaya devam ediyor.
Kanıt: `src/app/api/ikas/webhook/route.ts:113-136` yalnızca `prisma.*.deleteMany` çağırıyor. `graphql-requests.ts` içinde delete mutation'ı yok. `track/view/route.ts:54` yalnızca HMAC'i doğruluyor, kurulum durumuna bakmıyor; kaldırmadan sonra yeni `productView` satırları yazılıyor.
Düzeltme: Veriyi silmeden önce `deleteStorefrontJSScript()` çağır (argümansız, `[schema]` doğrulandı; `STOREFRONT_SF_SCRIPT` not_found = başarı). `track/view` AuthToken'ı olmayan merchant'ı reddetsin.

## 2. Uyarılar
**U1 · Kaldırma / script kurulumu (§6.2, §10 #17) `[observed]` R5**
Bulgu: Takip script'i kurulumda otomatik eklenmiyor; yalnızca Ayarlar'daki düğmeyle ekleniyor.
Kanıt: `installOrUpdateTrackingScript`'in tek çağıranı `api/tracking-script/install` (UI: `TrackingScriptSection.tsx:51`). Callback'te çağrılmıyor. Ürünün merkezi panelde olduğu için Uyarı; reviewer dönüşüm kartını ürünün parçası sayarsa R5 kapsamında Blocker olur.
Düzeltme: Callback'teki `after()` içinde script'i kur (hata kurulumu kırmasın) veya listeleme metninde script'in isteğe bağlı olduğunu belirt.

**U2 · OAuth başlatma — eksik scope (§2.1, §11) `[docs:admin-app]` `[sdk]`**
Bulgu: `createStorefrontJSScript`/`updateStorefrontJSScript` (storefront) ve `updateProduct` (products yazma) çağrılıyor ama kod `write_storefronts` ve `write_products` istemiyor.
Kanıt: `src/globals/config.ts:9` scope listesi: `read_orders,write_orders,read_products,read_inventories,write_inventories`. Çağrılar: `lib/tracking-script.ts:239,256,283`, `api/ikas/assign-vendor/route.ts:67`.
Düzeltme: İki scope'u listeye ekle ve Partner panel › Uygulama Yetkileri'ni aynı listeye getir. Geçerli izinler panelden geldiği için bugün çalışıyorsa panelde bu izinler zaten işaretli demektir.

**U3 · OAuth başlatma — redirect URI (§2.1, §10 #6) `[starter]`**
Bulgu: `NEXT_PUBLIC_DEPLOY_URL` normalize edilmeden redirect URI'ye ekleniyor. Env'in sonunda `/` varsa URI `//api/...` olur ve eşleşme bozulur.
Kanıt: `src/globals/config.ts:12`.
Düzeltme: `process.env.NEXT_PUBLIC_DEPLOY_URL?.replace(/\/+$/, '')` ile bir kez normalize et (F4).

**U4 · OAuth başlatma — state (§2.1, §10 #1) `[security]` `[starter]`**
Bulgu: CSRF `state` değeri `Math.random()` ile üretiliyor.
Kanıt: `src/app/api/oauth/authorize/ikas/route.ts:39`.
Düzeltme: `randomBytes(32).toString('base64url')` kullan (F3).

**U5 · OAuth callback (§2.2) `[security]`**
Bulgu: Token kaydedilmeden önce `getAuthorizedApp.storeAppId`'nin bu uygulamaya ait olduğu ve `deleted` olmadığı kontrol edilmiyor.
Kanıt: `src/app/api/oauth/callback/ikas/route.ts:95-127`: `isSuccess` kontrol ediliyor, `storeAppId` ve `deleted` kontrol edilmiyor.
Düzeltme: `storeAppId === config.oauth.clientId && !deleted` değilse 403 dön ve kaydetme.

**U6 · Panel içi yükleme — callback yönlendirmesi (§3.3, §10 #5) `[observed]` `[starter]`**
Bulgu: Callback iframe dalı olmadan koşulsuz `window.location.replace(redirectUrl)` yapıyor. `reAuthorizeApp` sonrası iframe içinde ikinci bir Admin açılabilir.
Kanıt: `src/helpers/token-helpers.ts:121`.
Düzeltme: `window.self !== window.top` ise `router.replace('/dashboard')` (F5).

**U7 · Panel içi yükleme — sentinel (§3.3) `[starter]`**
Bulgu: `setToken`'ın fırlattığı `'redirectUrl-called'` değeri yakalanmıyor ve unhandled rejection'a dönüşüyor.
Kanıt: `src/app/callback/page.tsx:21-27`: async IIFE'de `catch` yok.
Düzeltme: `.catch(e => { if (e !== 'redirectUrl-called') throw e; })` ekle (F6).

**U8 · Panel içi yükleme — kurulu sanma (§2.2, §10 #23) `[observed]` E1, E3 `[starter]`**
Bulgu: Kök sayfa bridge token'ını kurulum kanıtı sayıp `/dashboard`'a gidiyor. Callback başarısız olduysa backend'de token yok; merchant OAuth'a yönlendirilmek yerine hata ekranı görüyor.
Kanıt: `src/hooks/use-base-home-page.ts:43-48`; `api/ikas/get-merchant/route.ts:30` 404 dönüyor, dashboard `ErrorState` gösteriyor (`dashboard/page.tsx:167`).
Düzeltme: `/dashboard`'a gitmeden önce backend'de token var mı diye sor; yoksa `window.top.location` ile authorize başlat.

**U9 · Webhook imzası — şema (§6.1)**
Bulgu: Webhook gövdesi `JSON.parse` sonrası şema doğrulaması olmadan `as IkasWebhook` ile kullanılıyor.
Kanıt: `src/app/api/ikas/webhook/route.ts:46`.
Düzeltme: 7 alanlı zod şemasıyla doğrula; geçmezse 400 dön.

**U10 · Gizli anahtarlar ve ayar (§8, §5.1, §10 #15) `[starter]`**
Bulgu: JWT imzası ve oturum parolası boş string'e düşebiliyor; `CLIENT_SECRET` eksik bir deploy `''` ile imzalanmış token kabul eder.
Kanıt: `src/helpers/jwt-helpers.ts:16,30` `process.env.CLIENT_SECRET || ''`; `src/lib/session.ts:18` `config.cookiePassword || ''`.
Düzeltme: Açılışta zorunlu env'leri kontrol et (secret yoksa hata fırlat); cookie parolası 32+ karakter olmalı.

**U11 · Storefront uçları — rate limit (§9) `[security]`**
Bulgu: Anonim görüntülenme yazısı yalnızca IP başına ve instance belleğinde sınırlanıyor. Vercel'de her instance'ın kendi sayacı var; IP değiştirerek sayım şişirilebilir.
Kanıt: `src/app/api/track/view/route.ts:40-43`; `src/lib/rate-limit.ts:1-7` (in-memory, dosya kendisi de "Faz 2" diyor).
Düzeltme: Anahtarı `merchantId+IP` (ve mümkünse oturum) yap, sayacı paylaşımlı bir store'a taşı.

**U12 · Backend API — inline GraphQL (§5.3, §10 #11)**
Bulgu: `createOrderWithTransactions` mutation'ı `graphql-requests.ts` dışında elle yazılmış ve codegen tiplerini kullanmıyor. CLAUDE.md kuralına da aykırı.
Kanıt: `src/lib/seed-orders.ts:20-21,155`. Yalnızca dev'deki `api/dev/seed-orders`'tan çağrılıyor.
Düzeltme: Belgeyi `graphql-requests.ts`'e taşı ve `pnpm codegen` çalıştır.

## 3. Kod dışında doğrulanacaklar
| Soru | Neden |
|---|---|
| Partner hesabı oluşturuldu ve uygulama bu hesaba eklendi mi? | Yayın ön koşulu (§1 #1) |
| Partner hesabı doğrulandı mı? | Yayın ön koşulu (§1 #2) |
| Uygulama en az 2 geliştirme mağazasında kurulu ve test edilebilir mi? Partner panel › İzin Verilen Mağazalar'da "Kullanımda" görünen mağaza adları neler? | Yayın ön koşulu (§1 #5), ret R7 |
| Script kurulumda otomatik ekleniyor, kaldırmada otomatik siliniyor mu? (Şu an ikisi de hayır: B1, U1) | Kaldırma (§6.2), ret R5 |
| Uygulama bağımsız, somut bir işlev sunuyor mu? (Kodda evet: stok, analiz, kurallar) | Yayın ön koşulu (§1), ret R6 |
| Partner panel › Konfigürasyon › Bildirim Adresi `<deployUrl>/api/ikas/webhook` olarak girildi mi? `store/app/deleted` yalnızca oradan gelir, `saveWebhooks` ile alınamaz | Kaldırma (§6.2) |
| Partner panel › Uygulama Yetkileri koddaki scope listesiyle birebir aynı mı? `write_storefronts` ve `write_products` panelde işaretli mi? ("Tüm Yetkiler" seçiliyse fazla izin istenmiş olur) | OAuth başlatma (§2.1), U2 |
| Partner panel › Uygulama Adresi = `<deployUrl>`, Yönlendirme Adresi = `<deployUrl>/api/oauth/callback/ikas` mi? | OAuth (§2.1, §8) |
| Production (Vercel) `NEXT_PUBLIC_DEPLOY_URL` gerçek URL'e ayarlandı mı, sonunda `/` yok mu? | OAuth başlatma (§2.1), U3 |
| Yayınlama › listeleme "Herkese Açık" mı (review'a gider) yoksa "Gizli" mi (review yok)? | Yayın ön koşulu (§1) |

## 4. Temiz alanlar ve notlar
- `api/oauth/callback/ikas/route.ts:49-57` — signature varsa doğrulanıyor, state yalnızca ikisi de varsa karşılaştırılıyor (R4 güvenli), `session.state` siliniyor, tarayıcıya yalnızca 4 saatlik JWT gidiyor.
- `api/ikas/webhook/route.ts:38-65` — secret yoksa 500, imza hatasında 401, `webhook.id` ile idempotent; hatada 500 (dürüst status kodları).
- Kaldırmada `authToken` satırı siliniyor (`route.ts:132`), böylece JWT'li route'lar ölü token'ı bulamıyor. Scanner'ın §5.1 "deleted kontrolü yok" uyarısı bu nedenle düşürüldü.
- `dashboard/layout.tsx:43` — `closeLoader()` tüm `/dashboard/*` sayfalarını kapsıyor. Scanner'ın 6 adet §3.1 uyarısı yanlış alarm, düşürüldü. Kök sayfa da hook içinde çağırıyor.
- `api/track/view/route.ts` — scanner §5.1 Blocker'ı yanlış sınıflandırma: bu bir §9 storefront ucu. HMAC token merchant'a bağlı (`lib/track-token.ts`, timingSafeEqual), CORS var, para alanı yok. Test dosyasındaki hit de aynı.
- `lib/sync/register-webhooks.ts:8` — scanner'ın INVALID_SCOPE uyarısı yanlış: `store/app/deleted` yalnızca yorumda geçiyor, kayıt listesi 6 geçerli scope ve https koruması var.
- `api/feedback/route.ts:32` — scanner'ın §5.1 uyarısı yanlış: `merchantId` JWT'den geliyor, satır 32 e-posta HTML'i.
- Scanner "inventories kullanılmıyor" dedi ama `saveVariantStocks` (§11 inventories) kullanılıyor; `write_orders` dev seed'de `createOrderWithTransactions` için. Bulgu yok.
- `api/cron/digest`, `api/cron/rules` — Bearer + timingSafeEqual, `CRON_SECRET` yoksa 503 (operatör ucu, §5.1 muaf).
- `api/dev/token` yalnızca `development`'ta, `api/dev/seed-orders` production'da 403; analytics mock'u production'da kapalı (`analytics/route.ts:19`).
- `api/ikas/webhook/route.ts:92` — `store/product/deleted` dalı ölü; `saveWebhooks` bu scope'u kabul etmiyor (E5) ve kayıtlı listede de yok.
- §4 dil: `getDashboardLanguage()` kullanılmıyor; panel Türkçe, `/authorize-store` İngilizce (Bilgi).
- `.env`, `.env.resend-prod.local`, `.env.vercel.local` gitignored (Bilgi; deploy bu ağaçtan yapılırsa dahil olmaz, Vercel env'i ayrı).
- §10 taraması: ✓ 2, 3, 4, 8, 9, 10, 13, 14, 18, 19, 20, 22 · n/a 12, 21, 24, 25, 26 · bulgu 1→U4, 5→U6, 6→U3, 11→U12, 15→U10, 16→U2, 17→B1/U1, 23→U8

## 5. İsteğe bağlı öneriler (kural gerektirmiyor)
- Kaldırma işleyicisi `webhookEvent` satırlarını da sildiği için aynı teslimatın tekrarı temizliği yeniden çalıştırır. B1'den sonra "AuthToken yoksa 200 skipped" kısa devresi ekle (ölü token ile API çağrısı olmasın).
- `deleteStorefrontJSScript` çağrısına kısa bir zaman aşımı ver; `onCheckToken` refresh'i kaldırmadan sonra 30 sn+ asılı kalabiliyor (E1).
- README'ye `tracker.js`'in anonim `/api/track/view` çağrısını ve Admin API'ye tarayıcıdan gidilmediğini yaz; reviewer'ın işini kolaylaştırır.

---
Bu kural setine göre tek Blocker B1. Katalogda hazır tarifi olan düzeltmeler: F3 (U4), F4 (U3), F5 (U6), F6 (U7).

## 7. Uygulanan düzeltmeler (2026-09-25)
- **F3** `api/oauth/authorize/ikas/route.ts` — `state` artık `randomBytes(32).toString('base64url')` → U4
- **F4** `globals/config.ts` — deploy URL'in sonundaki `/` kırpılıyor → U3
- **F5** `helpers/token-helpers.ts` — iframe içindeyse `router.replace('/dashboard')` → U6
- **F6** `app/callback/page.tsx` — `'redirectUrl-called'` sentinel'i yakalanıyor → U7
- **B1** `graphql-requests.ts` + codegen — `deleteStorefrontJSScript` eklendi; `lib/tracking-script.ts` `removeTrackingScript` (refresh'siz, 8 sn zaman aşımı, not_found = başarı); `api/ikas/webhook/route.ts` kaldırmada token silinmeden önce çağırıyor, token yoksa (tekrar teslimat) API çağrısı yapmıyor
- **B1** `api/track/view/route.ts` — AuthToken'ı olmayan (kaldırılmış) merchant'a 410; test eklendi
- **U1** `api/oauth/callback/ikas/route.ts` — https ortamda script `after()` içinde otomatik kuruluyor (hata kurulumu kırmıyor)
- **U2** `globals/config.ts` — scope'a `write_products`, `write_storefronts` eklendi (Partner paneliyle eşlenmeli)
- **U5** callback — `getAuthorizedApp.storeAppId`/`deleted` sorgulanıyor; başka uygulama veya silinmiş yetki → 403
- **U8** `hooks/use-base-home-page.ts` — backend 404 (token yok) dönerse `/authorize-store?storeName=…`; `authorize-store` formu `target="_top"` ile üst pencerede OAuth başlatıyor
- **U9** `api/ikas/webhook/route.ts` — zod zarf şeması (7 alan; `createdAt` string veya sayı), geçmezse 400
- **U10** `helpers/jwt-helpers.ts`, `lib/session.ts` — `|| ''` kaldırıldı; secret yoksa / parola < 32 karakterse açık hata
- **U11 (kısmi)** `api/track/view/route.ts` — IP limitine ek mağaza başına dakikada 600 sınırı; sayaç hâlâ instance belleğinde (paylaşımlı store altyapı kararı)
- **U12** `lib/seed-orders.ts` — inline GraphQL + elle `fetch` kaldırıldı; `CREATE_ORDER_WITH_TRANSACTIONS` + `ikasClient.mutations.createOrderWithTransactions` (ikas MCP introspect + canlı şema ile doğrulandı)

Type-check: ✅ geçti · Lint: ✅ · Vitest: ✅ 37 dosya / 371 test
Scanner (sonra): §6.2 storefront Blocker'ı, eksik scope, Math.random, URL, sentinel, iframe ve `|| ''` hit'leri kayboldu. Kalanlar bölüm 4'te gerekçelendirilmiş yanlış alarmlar (track/view §5.1, dashboard §3.1, feedback, register-webhooks, inventories; webhook:94 F11 hit'i ürün dalında, kaldırma dalı token yoksa atlıyor).

Commit yapılmadı. Deploy sonrası dikkat: scope değişikliği mevcut kurulumlardan yeniden yetki isteyebilir (grant'i Partner paneli belirler); `SECRET_COOKIE_PASSWORD` Vercel'de 32+ karakter olmalı.
