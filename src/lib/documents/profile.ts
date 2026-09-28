import type { GetMerchantProfileQueryData } from '@/lib/ikas-client/generated/graphql';

/**
 * Sipariş belgelerindeki "sipariş veren" — ikas mağaza hesabındaki fatura
 * bilgisinden (unvan, vergi dairesi, VKN, adres). Boş alanlar belgeye basılmaz.
 */
export type MerchantProfile = {
  storeName: string | null;
  /** Ticari unvan (kurumsal hesapta şirket adı). */
  legalName: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  /** Adres satırları; son satır "posta kodu ilçe / il". */
  addressLines: string[];
  phone: string | null;
};

export const EMPTY_PROFILE: MerchantProfile = {
  storeName: null,
  legalName: null,
  taxOffice: null,
  taxNumber: null,
  addressLines: [],
  phone: null,
};

const clean = (value: string | null | undefined): string | null => value?.trim() || null;

export function profileFromMerchant(raw: GetMerchantProfileQueryData | null | undefined): MerchantProfile {
  if (!raw) return EMPTY_PROFILE;
  const a = raw.address ?? null;
  const place = [clean(a?.district?.name), clean(a?.city?.name)].filter(Boolean).join(' / ');
  const lastLine = [clean(a?.postalCode), place || null].filter(Boolean).join(' ');
  return {
    storeName: clean(raw.storeName),
    legalName: clean(a?.company) ?? clean(a?.title),
    taxOffice: clean(a?.taxOffice),
    taxNumber: clean(a?.vkn) ?? clean(a?.taxNumber),
    addressLines: [clean(a?.addressLine1), clean(a?.addressLine2), lastLine || null].filter((l): l is string => l !== null),
    phone: clean(raw.phoneNumber),
  };
}

/** Belgenin başlığındaki ad: mağaza adı, yoksa unvan. */
export function displayName(profile: MerchantProfile): string {
  return profile.storeName ?? profile.legalName ?? 'Mağazamız';
}

/** Logo yerine monogram: adın ilk harfi (Türkçe büyük harf). */
export function monogram(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toLocaleUpperCase('tr-TR') : '•';
}
