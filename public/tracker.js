/**
 * Flowventory — Ürün Görüntülenme Takibi
 *
 * ikas storefront'una eklenir. Ürün detay sayfası açıldığında
 * PRODUCT_VIEW event'ini yakalar ve backend'e gönderir.
 *
 * Aynı ürünün kısa süre içinde tekrar sayılmasını önlemek için
 * sessionStorage üzerinden basit bir cooldown uygulanır.
 */
(function () {
  var API_URL = 'https://tap-bit-accordance-bolt.trycloudflare.com'; // ikas app dev başlayınca güncellenecek
  var MERCHANT_ID = '__MERCHANT_ID__'; // kurulum sırasında merchant'a göre doldurulur
  var COOLDOWN_MS = 30 * 60 * 1000;      // aynı ürün için 30 dakika

  /**
   * Bu ürün yakın zamanda sayıldı mı?
   * sessionStorage'da "flowventory_view_<merchantId>_<productId>" anahtarında
   * son gönderim zamanını tutuyoruz. Merchant bazlı ayırıyoruz ki farklı
   * mağazaların aynı ürün id'si çakışmasın.
   */
  function shouldTrack(productId) {
    try {
      var key = 'flowventory_view_' + MERCHANT_ID + '_' + productId;
      var last = sessionStorage.getItem(key);
      var now = Date.now();

      if (last && now - parseInt(last, 10) < COOLDOWN_MS) {
        return false; // cooldown içinde, sayma
      }

      sessionStorage.setItem(key, String(now));
      return true;
    } catch (e) {
      return true; // sessionStorage yoksa yine de say
    }
  }

  function sendView(productId) {
    if (!productId || !MERCHANT_ID || MERCHANT_ID === '__MERCHANT_ID__') return;
    if (!shouldTrack(productId)) return;

    fetch(API_URL + '/api/track/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId, merchantId: MERCHANT_ID }),
    }).catch(function (err) {
      // Storefront'u bozmamak için sessizce geç
      console.warn('[Flowventory] view gönderilemedi:', err.message);
    });
  }

  // IkasEvents hazır olmasını bekle
  function init() {
    if (!window.IkasEvents || typeof window.IkasEvents.subscribe !== 'function') {
      setTimeout(init, 300);
      return;
    }

    window.IkasEvents.subscribe({
      id: 'flowventory_product_view',
      callback: function (event) {
        if (event.type === 'PRODUCT_VIEW') {
          var productId = event.data && event.data.productDetail && event.data.productDetail.id;
          sendView(productId);
        }
      },
    });
  }

  init();
})();