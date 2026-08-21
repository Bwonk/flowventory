'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { MerchantSettingsApiResponse } from '@/app/api/merchant-settings/route';
import type { TrackingScriptStatusApiResponse } from '@/app/api/tracking-script/status/route';

export interface AyarlarData {
  token: string | null;
  trackingStatus: TrackingScriptStatusApiResponse | null;
  settings: MerchantSettingsApiResponse | null;
  loading: boolean;
  error: string | null;
  /** Tüm verileri yeniden çeker (retry butonu için). */
  reload: () => void;
}

/**
 * Ayarlar veri katmanı — token init + iki bölümün fetch'leri tek geçişte.
 * Sayfa component'ı yalnızca render'la ilgilenir (CLAUDE.md konvansiyonu).
 * Bölüm mutasyonları (install/update) bölüm bileşenlerinde kalır.
 */
export function useAyarlarData(): AyarlarData {
  const [token, setToken] = useState<string | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingScriptStatusApiResponse | null>(null);
  const [settings, setSettings] = useState<MerchantSettingsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);
      if (!fetchedToken) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }

      // İki fetch aynı oturuma dayanır; biri düşerse bölüm kendi boş durumunu
      // gösterir, yalnızca ikisi birden düşerse sayfa hatası veririz.
      const [trackingOk, settingsOk] = await Promise.all([
        ApiRequests.trackingScript
          .getStatus(fetchedToken)
          .then(res => {
            if (res.status === 200 && res.data?.data) {
              setTrackingStatus(res.data.data);
              return true;
            }
            return false;
          })
          .catch(error => {
            logger.error('Error fetching tracking script status', { error });
            return false;
          }),
        ApiRequests.merchantSettings
          .get(fetchedToken)
          .then(res => {
            if (res.status === 200 && res.data?.data) {
              setSettings(res.data.data);
              return true;
            }
            return false;
          })
          .catch(error => {
            logger.error('Error fetching merchant settings', { error });
            return false;
          }),
      ]);

      if (!trackingOk && !settingsOk) {
        setError('Ayarlar alınamadı.');
      }
    } catch (error) {
      logger.error('Error initializing ayarlar', { error });
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { token, trackingStatus, settings, loading, error, reload: initialize };
}
