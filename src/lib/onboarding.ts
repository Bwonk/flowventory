import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { OnboardingStatus } from '@/lib/onboarding-status';
import { DEFAULT_STOCK_THRESHOLD, useStockThreshold } from '@/lib/stock-threshold';

/**
 * Onboarding ("Başlarken") durumu — Başlarken sayfasının ve nav rozetinin
 * tek kaynağı.
 *
 * Desen `stock-threshold.ts` / `currency.ts` ile aynı: storage anahtarları,
 * custom event ve hook tek modülde yaşar; üreticiler (rapor sayfası, ayarlar
 * kartları) mark-helper'ları buradan import eder — anında güncellenir.
 *
 * Adım tamamlanma kaynakları (sunucu VEYA istemci bayrağı):
 * - sync / tracker / threshold: `GET /api/onboarding/status` (SyncLog,
 *   TrackingScriptInstall, MerchantSettings — cihazdan bağımsız). İstemci
 *   bayrakları (`mark*`) sunucu yanıtı gelmeden iyimser tamamlar.
 * - threshold ayrıca: canlı `useStockThreshold()` varsayılandan farklıysa ya da
 *   "Varsayılanı kullan" onayı (`confirmDefaultThreshold`) — 5/10'u bilinçli
 *   seçen mağaza da tamamlanmış sayılır.
 * - report: rapor sayfası ziyareti (localStorage bayrağı).
 */

const DISMISS_KEY = 'flowventory:onboarding-dismissed'; // mevcut literal — eski kullanıcı ilerlemesi korunur
const REPORT_KEY = 'flowventory:report-viewed'; // mevcut literal — rapor sayfası yazar
const TRACKER_KEY = 'flowventory:onboarding-tracker'; // '1' = kurulu görüldü (iyimser)
const SYNC_KEY = 'flowventory:store-synced'; // ilk başarılı veri senkronu (iyimser)
const THRESHOLD_CONFIRMED_KEY = 'flowventory:threshold-confirmed'; // varsayılan eşik bilinçli onaylandı
const COMPLETE_KEY = 'flowventory:onboarding-complete'; // mezun: tüm adımlar bitti, fetch yok
const LANDED_KEY = 'flowventory:onboarding-popup-seen'; // ilk açılış popup'ı gösterildi
const CHANGE_EVENT = 'flowventory:onboarding-change';

export type OnboardingStepKey = 'sync' | 'tracker' | 'threshold' | 'report';

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  /** Birincil aksiyon etiketi (emir kipi). */
  cta: string;
  done: boolean;
}

const STEP_DEFS = [
  {
    key: 'sync',
    title: 'Mağaza verini senkronla',
    description:
      'Ürünler, stoklar ve son satışlar ikas’tan çekilir. Kurulumda arka planda başlar; bitmediyse buradan elle tetikle.',
    href: '/dashboard/ayarlar#veri-senkron',
    cta: 'Senkron ayarları',
  },
  {
    key: 'tracker',
    title: 'Takip scriptini kur',
    description:
      'Vitrindeki ürün görüntülenmeleri toplanır; "çok bakılıp az satan" ürünler Analiz’de görünür.',
    href: '/dashboard/ayarlar#takip-scripti',
    cta: 'Scripti kur',
  },
  {
    key: 'threshold',
    title: 'Stok eşiklerini ayarla',
    description:
      'Hangi stok seviyesinin "kritik", hangisinin "az kalan" sayılacağını belirle. Uyarılar, kurallar ve satın alma önerileri bu eşiklere göre çalışır.',
    href: '/dashboard/stok',
    cta: 'Eşikleri ayarla',
  },
  {
    key: 'report',
    title: 'Satın alma raporunu incele',
    description: 'Satış hızına göre tedarikçi bazlı sipariş önerilerini gör; PDF olarak paylaş.',
    href: '/dashboard/rapor',
    cta: 'Raporu aç',
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

function writeFlag(key: string, on = true): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    // localStorage erişilemezse (private mode) sessiz geç.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Rapor sayfası ziyaret edildi — "raporu incele" adımı tamamlandı. */
export function markReportViewed(): void {
  writeFlag(REPORT_KEY);
}

/** Mağaza verisi en az bir kez başarıyla senkronlandı (iyimser — sunucu da bilir). */
export function markStoreSynced(): void {
  writeFlag(SYNC_KEY);
}

/** Takip scripti kuruldu (iyimser — sunucu da bilir). */
export function markTrackerInstalled(): void {
  writeFlag(TRACKER_KEY);
}

/** Varsayılan 5/10 eşiği bilinçli olarak kullanılacak. */
export function confirmDefaultThreshold(): void {
  writeFlag(THRESHOLD_CONFIRMED_KEY);
}

/** Rehberi gizle ("Rehberi gizle"). */
export function dismissOnboarding(): void {
  writeFlag(DISMISS_KEY);
}

/** Gizlenen rehberi geri getir. */
export function restoreOnboarding(): void {
  writeFlag(DISMISS_KEY, false);
}

/**
 * İlk açılışta bir kez `true` döner (bayrağı yazar): rehber mezun ya da
 * gizlenmiş değilse Başlarken popup'ı kendiliğinden açılsın.
 */
export function consumeFirstLanding(): boolean {
  if (readFlag(LANDED_KEY)) return false;
  writeFlag(LANDED_KEY);
  return !readFlag(COMPLETE_KEY) && !readFlag(DISMISS_KEY);
}

export interface OnboardingSignals {
  server: OnboardingStatus | null;
  storeSynced: boolean;
  trackerInstalled: boolean;
  thresholdChanged: boolean;
  thresholdConfirmed: boolean;
  reportViewed: boolean;
  /** Mezun: tüm adımlar bir kez bitti — hepsi tamam sayılır. */
  complete: boolean;
}

/** Sunucu + istemci sinyallerinden adım listesini türetir (saf). */
export function deriveOnboardingSteps(signals: OnboardingSignals): OnboardingStep[] {
  const { server, complete } = signals;
  const done: Record<OnboardingStepKey, boolean> = {
    sync: Boolean(server?.sync) || signals.storeSynced,
    tracker: Boolean(server?.tracker) || signals.trackerInstalled,
    threshold: Boolean(server?.threshold) || signals.thresholdChanged || signals.thresholdConfirmed,
    report: signals.reportViewed,
  };
  return STEP_DEFS.map(def => ({ ...def, done: complete || done[def.key] }));
}

// Sidebar rozeti ve sayfa aynı anda bağlanır — tek uçuşta tek istek.
let inflight: Promise<OnboardingStatus | null> | null = null;

function fetchServerStatus(): Promise<OnboardingStatus | null> {
  inflight ??= (async () => {
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) return null;
      const res = await ApiRequests.onboarding.getStatus(token);
      return res.data?.data ?? null;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const EMPTY_STATUS: OnboardingStatus = { sync: false, tracker: false, threshold: false };

export interface OnboardingState {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  /** Sunucu durumu henüz gelmedi — rozet/sayfa titremesin diye bekle. */
  loading: boolean;
  /** Tüm adımlar tamam (bu oturumda ya da daha önce). */
  complete: boolean;
  /** Rehber gizlendi. */
  dismissed: boolean;
  dismiss: () => void;
  restore: () => void;
}

/**
 * Onboarding adımlarının canlı durumu. Aynı sekmede `CHANGE_EVENT`, sekmeler
 * arası `storage` event ile senkronize olur; eksik adım varken her sayfa
 * değişiminde sunucu durumu tazelenir (arka plan senkronu, başka sekmede
 * kurulan script yakalansın).
 */
export function useOnboardingSteps(): OnboardingState {
  const [flags, setFlags] = useState({
    dismissed: false,
    graduated: true, // SSR flash önleme: ilk boyamada mezun say, fetch yok
    reportViewed: false,
    storeSynced: false,
    trackerInstalled: false,
    thresholdConfirmed: false,
    hydrated: false,
  });
  const [server, setServer] = useState<OnboardingStatus | null>(null);
  const { threshold } = useStockThreshold();
  const pathname = usePathname();

  // Bayrakları oku + değişikliklere abone ol.
  useEffect(() => {
    const sync = () =>
      setFlags({
        dismissed: readFlag(DISMISS_KEY),
        graduated: readFlag(COMPLETE_KEY),
        reportViewed: readFlag(REPORT_KEY),
        storeSynced: readFlag(SYNC_KEY),
        trackerInstalled: readFlag(TRACKER_KEY),
        thresholdConfirmed: readFlag(THRESHOLD_CONFIRMED_KEY),
        hydrated: true,
      });
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const thresholdChanged =
    threshold.min !== DEFAULT_STOCK_THRESHOLD.min || threshold.max !== DEFAULT_STOCK_THRESHOLD.max;

  const steps = deriveOnboardingSteps({
    server,
    storeSynced: flags.storeSynced,
    trackerInstalled: flags.trackerInstalled,
    thresholdChanged,
    thresholdConfirmed: flags.thresholdConfirmed,
    reportViewed: flags.reportViewed,
    complete: flags.graduated,
  });
  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  const refresh = useCallback(async () => {
    const status = await fetchServerStatus();
    setServer(status ?? EMPTY_STATUS);
  }, []);

  // Mezun kullanıcıda ağ maliyeti sıfır; diğerlerinde ilk açılış + eksik
  // adım varken her sayfa değişimi.
  useEffect(() => {
    if (!flags.hydrated) return;
    if (flags.graduated) {
      setServer(EMPTY_STATUS);
      return;
    }
    if (server !== null && allDone) return;
    void refresh();
    // `server`/`allDone` bilerek dışarıda: yalnız sayfa değişimi tetikler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags.hydrated, flags.graduated, pathname, refresh]);

  // Mezuniyet: hepsi bitti → kalıcı bayrak, sonraki oturumlarda fetch yok.
  // CHANGE_EVENT atılmaz; bu oturumdaki tamamlanma animasyonu bozulmasın.
  useEffect(() => {
    if (flags.hydrated && !flags.graduated && server !== null && allDone) {
      try {
        window.localStorage.setItem(COMPLETE_KEY, '1');
      } catch {
        // Sessiz geç.
      }
    }
  }, [flags.hydrated, flags.graduated, server, allDone]);

  return {
    steps,
    doneCount,
    total: steps.length,
    loading: !flags.hydrated || server === null,
    complete: allDone,
    dismissed: flags.dismissed,
    dismiss: dismissOnboarding,
    restore: restoreOnboarding,
  };
}
