import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { DEFAULT_STOCK_THRESHOLD, useStockThreshold } from '@/lib/stock-threshold';

/**
 * Onboarding ("Başlarken") durumu — sidebar'daki kurulum kartının tek kaynağı.
 *
 * Desen `stock-threshold.ts` / `currency.ts` ile aynı: storage anahtarları,
 * custom event ve hook tek modülde yaşar; üreticiler (rapor sayfası, script
 * kurulum kartı) mark-helper'ları buradan import eder — layout'a bağımlılık
 * kurmadan kart anında güncellenir.
 *
 * Adım tamamlanma kaynakları:
 * - tracker: `GET /api/tracking-script/status` (pozitif sonuç localStorage'a
 *   cache'lenir — kurulan script sökülmez, tekrar sormaya gerek yok).
 * - threshold: `useStockThreshold()` — varsayılan 5/10'dan farklıysa "tamam".
 *   Bilinen sınır: 5/10'u bilinçli seçen mağaza "yapılmadı" görünür; mevcut
 *   davranış, düzeltilmiyor.
 * - report: rapor sayfası ziyareti (localStorage bayrağı).
 */

const DISMISS_KEY = 'flowventory:onboarding-dismissed'; // mevcut literal — eski kullanıcı ilerlemesi korunur
const REPORT_KEY = 'flowventory:report-viewed'; // mevcut literal — rapor sayfası yazar
const TRACKER_KEY = 'flowventory:onboarding-tracker'; // pozitif cache: '1' = kurulu görüldü
const COMPLETE_KEY = 'flowventory:onboarding-complete'; // mezun kullanıcı: kart kalıcı kapalı, fetch yok
const CHANGE_EVENT = 'flowventory:onboarding-change';

export interface OnboardingStep {
  key: 'tracker' | 'threshold' | 'report';
  title: string;
  description: string;
  href: string;
  done: boolean;
}

/** Dar sidebar için kısa kopya — uzun açıklamalar 214px kolonda 3+ satır olur. */
const STEP_DEFS = [
  {
    key: 'tracker',
    title: 'Takip scriptini kur',
    description: 'Görüntülenme verisi toplansın.',
    href: '/dashboard/ayarlar',
  },
  {
    key: 'threshold',
    title: 'Stok eşiklerini ayarla',
    description: 'Kritik ve az kalan seviyeleri.',
    href: '/dashboard/stok',
  },
  {
    key: 'report',
    title: 'Satın alma raporu',
    description: 'Sipariş önerilerini gör.',
    href: '/dashboard/rapor',
  },
] as const satisfies ReadonlyArray<Omit<OnboardingStep, 'done'>>;

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // localStorage erişilemezse (private mode) sessiz geç.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Rapor sayfası ziyaret edildi — "raporu incele" adımı tamamlandı. */
export function markReportViewed(): void {
  writeFlag(REPORT_KEY);
}

/** Takip scripti kuruldu — kart anında güncellensin (ayarlar kartı çağırır). */
export function markTrackerInstalled(): void {
  writeFlag(TRACKER_KEY);
}

/** Kartı kalıcı kapat (X butonu). */
export function dismissOnboarding(): void {
  writeFlag(DISMISS_KEY);
}

/** Kart kalıcı olarak devre dışı mı? (kapatıldı ya da tüm adımlar bitti) */
export function isOnboardingRetired(): boolean {
  return readFlag(DISMISS_KEY) || readFlag(COMPLETE_KEY);
}

/** İlk tamamlanmamış adımın index'i; hepsi bittiyse -1. */
export function firstIncompleteIndex(steps: ReadonlyArray<{ done: boolean }>): number {
  return steps.findIndex(s => !s.done);
}

/** `from`dan SONRAKİ ilk tamamlanmamış adım; kalmadıysa -1 (geriye sarmaz). */
export function nextIncompleteIndex(steps: ReadonlyArray<{ done: boolean }>, from: number): number {
  for (let i = from + 1; i < steps.length; i++) {
    if (!steps[i].done) return i;
  }
  return -1;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  /** Tracker durumu henüz bilinmiyor — kart titremesin diye render etme. */
  loading: boolean;
  /** Kalıcı kapalı (dismiss ya da mezuniyet). */
  retired: boolean;
  dismiss: () => void;
}

/**
 * Onboarding adımlarının canlı durumu. Aynı sekmede `CHANGE_EVENT`, sekmeler
 * arası `storage` event ile senkronize olur; threshold adımı
 * `useStockThreshold`'un kendi canlı senkronundan beslenir.
 */
export function useOnboardingSteps(): OnboardingState {
  const [retired, setRetired] = useState(true); // SSR flash önleme: kapalı başla
  const [trackerInstalled, setTrackerInstalled] = useState<boolean | null>(null);
  const [reportViewed, setReportViewed] = useState(false);
  const { threshold } = useStockThreshold();
  const pathname = usePathname();

  // Bayrakları oku + değişikliklere abone ol.
  useEffect(() => {
    const sync = () => {
      setRetired(isOnboardingRetired());
      setReportViewed(readFlag(REPORT_KEY));
      if (readFlag(TRACKER_KEY)) setTrackerInstalled(true);
    };
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Tracker durumunu sunucudan çek — emekli kullanıcı ve pozitif cache'te hiç fetch yok.
  const fetchTracker = useCallback(async () => {
    if (isOnboardingRetired() || readFlag(TRACKER_KEY)) {
      setTrackerInstalled(readFlag(TRACKER_KEY));
      return;
    }
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) {
        setTrackerInstalled(false);
        return;
      }
      const res = await ApiRequests.trackingScript.getStatus(token);
      const installed = Boolean(res.data?.data?.installed);
      if (installed) {
        // Pozitif cache — sonraki yüklemelerde ağ maliyeti sıfır.
        try {
          window.localStorage.setItem(TRACKER_KEY, '1');
        } catch {
          // Sessiz geç.
        }
      }
      setTrackerInstalled(installed);
    } catch {
      setTrackerInstalled(false);
    }
  }, []);

  useEffect(() => {
    void fetchTracker();
  }, [fetchTracker]);

  // Emniyet ağı: ayarlar sayfasından ayrılırken hâlâ kurulu görünmüyorsa bir
  // kez daha sor — event'imizi atlayan kurulum yolları (başka sekme, tema
  // editörü) için. Kurulunca cache devreye girer, tekrar sorulmaz.
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (prev === '/dashboard/ayarlar' && pathname !== prev && trackerInstalled === false) {
      void fetchTracker();
    }
  }, [pathname, trackerInstalled, fetchTracker]);

  const thresholdSet =
    threshold.min !== DEFAULT_STOCK_THRESHOLD.min || threshold.max !== DEFAULT_STOCK_THRESHOLD.max;

  const steps: OnboardingStep[] = STEP_DEFS.map(def => ({
    ...def,
    done:
      def.key === 'tracker'
        ? trackerInstalled === true
        : def.key === 'threshold'
          ? thresholdSet
          : reportViewed,
  }));

  const doneCount = steps.filter(s => s.done).length;

  // Mezuniyet: hepsi bitti → kalıcı bayrak, kart bir daha maliyet üretmez.
  // Bilerek CHANGE_EVENT atılmaz: `retired` bu oturumda false kalır ki kart
  // son adımın "done beat"ini oynatıp kendi çıkış animasyonunu yapabilsin.
  useEffect(() => {
    if (!retired && trackerInstalled !== null && doneCount === steps.length) {
      try {
        window.localStorage.setItem(COMPLETE_KEY, '1');
      } catch {
        // Sessiz geç.
      }
    }
  }, [retired, trackerInstalled, doneCount, steps.length]);

  const dismiss = useCallback(() => {
    dismissOnboarding();
    setRetired(true);
  }, []);

  return {
    steps,
    doneCount,
    total: steps.length,
    loading: trackerInstalled === null,
    retired,
    dismiss,
  };
}
