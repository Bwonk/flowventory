/**
 * Flowventory'nin tek ücretli planı — gösterim bilgisi (istemci + sunucu).
 *
 * Plan ikas Partner panelinde tanımlanır; buradaki fiyat yalnız gösterimdir
 * (KDV hariç). ikas mağazaya kalan lisans gününe göre oranlanmış fiyat +
 * KDV'yi kendi ödeme ekranında gösterir. TR bölgesinde yalnız yıllık plan
 * açılabildiğinden dönem seçimi yok. Diğer bölgelerin planları ve fiyatları
 * Partner panelden gelir (`IKAS_PLAN_KEY`, bkz. subscription-service.ts);
 * buradaki fiyat onlar alınamazsa gösterilen TR varsayılanıdır.
 */
export const PLAN = {
  name: 'Flowventory Pro',
  description: 'Stoklarını izleyen, ne zaman ne sipariş vereceğini söyleyen tam paket.',
  yearlyPrice: 980,
  currency: 'TRY',
  trialDays: 14,
  features: [
    'Sınırsız ürün ve stok takibi',
    'Kritik ve az kalan stok uyarıları',
    'Tedarikçi bazlı satın alma raporu (PDF)',
    'Otomatik stok kuralları',
    'Görüntülenme → satış analizi',
    'Günlük / haftalık e-posta özeti',
  ],
} as const;
