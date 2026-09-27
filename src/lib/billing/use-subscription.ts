'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import type { SubscriptionSummary } from '@/lib/billing/subscription-service';

/**
 * Abonelik durumu — sidebar rozeti, layout kilidi ve Başlarken sayfası aynı
 * modül store'unu paylaşır (tek istek, tek yoklama).
 *
 * Ödeme akışı: POST checkout → ikas ödeme id'si → `startMerchantPayment`
 * (App Bridge; geri çağrı yok) → `pending`: lisans 5 sn aralıkla en çok
 * 2 dk yoklanır, pencere odağı dönünce bir kez daha. Kaynak her zaman
 * getMerchantLicence; webhook yalnız bildirim üretir.
 */

interface SubscriptionStore {
  summary: SubscriptionSummary | null;
  loading: boolean;
  /** Durum alınamadı — kilit uygulanmaz (fail-open), kart hata gösterir. */
  error: boolean;
  /** Ödeme ekranı açıldı, sonuç bekleniyor. */
  pending: boolean;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;

const INITIAL: SubscriptionStore = { summary: null, loading: true, error: false, pending: false };
let store: SubscriptionStore = INITIAL;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let loadedOnce = false;
let pollTimer: number | null = null;
let pollDeadline = 0;

function setStore(patch: Partial<SubscriptionStore>) {
  store = { ...store, ...patch };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function loadSubscription(): Promise<void> {
  loadedOnce = true;
  inflight ??= (async () => {
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) throw new Error('token yok');
      const res = await ApiRequests.subscription.get(token);
      const summary = res.data?.data;
      if (!summary) throw new Error('boş yanıt');
      setStore({ summary, loading: false, error: false });
      if (summary.state === 'active') stopPolling();
    } catch (error) {
      logger.warn('Abonelik durumu alınamadı', { error });
      setStore({ loading: false, error: true });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function stopPolling() {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
  window.removeEventListener('focus', onFocus);
  if (store.pending) setStore({ pending: false });
}

function onFocus() {
  void loadSubscription();
}

function startPolling() {
  stopPolling();
  pollDeadline = Date.now() + POLL_TIMEOUT_MS;
  setStore({ pending: true });
  window.addEventListener('focus', onFocus);
  pollTimer = window.setInterval(() => {
    if (Date.now() > pollDeadline) {
      stopPolling();
      return;
    }
    void loadSubscription();
  }, POLL_INTERVAL_MS);
}

export type CheckoutResult = 'started' | 'disabled' | 'error';

async function startCheckout(): Promise<CheckoutResult> {
  try {
    const token = await TokenHelpers.getTokenForIframeApp();
    if (!token) return 'error';
    const res = await ApiRequests.subscription.checkout(token);
    const paymentId = res.data?.data?.paymentId;
    if (!paymentId) return 'error';
    AppBridgeHelper.startMerchantPayment(paymentId);
    startPolling();
    return 'started';
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 503) return 'disabled';
    logger.warn('Abonelik ödemesi başlatılamadı', { error });
    return 'error';
  }
}

export function useSubscription() {
  const snapshot = useSyncExternalStore(subscribe, () => store, () => INITIAL);

  useEffect(() => {
    if (!loadedOnce) void loadSubscription();
  }, []);

  const refresh = useCallback(() => loadSubscription(), []);
  const cancelPending = useCallback(() => stopPolling(), []);

  return { ...snapshot, refresh, startCheckout, cancelPending };
}
