/**
 * Flowventory'nin tek ücretli planı — gösterim bilgisi (istemci + sunucu).
 *
 * Plan ikas Partner panelinde tanımlanır; buradaki fiyat yalnız gösterimdir
 * (KDV hariç). ikas mağazaya kalan lisans gününe göre oranlanmış fiyat +
 * KDV'yi kendi ödeme ekranında gösterir. TR bölgesinde yalnız yıllık plan
 * açılabildiğinden dönem seçimi yok. Partner panel plan anahtarı sunucu
 * env'inde (`IKAS_PLAN_KEY`, bkz. subscription-service.ts).
 */
export const PLAN = {
  name: 'Flowventory',
  yearlyPrice: 980,
  currency: 'TRY',
  trialDays: 14,
  features: [
    'Stok takibi ve uyarılar',
    'Satın alma raporu',
    'Otomatik kurallar',
    'E-posta özetleri',
  ],
} as const;
