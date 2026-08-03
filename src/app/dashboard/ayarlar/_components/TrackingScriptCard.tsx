'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { TrackingScriptStatusApiResponse } from '@/app/api/tracking-script/status/route';

type UiPhase = 'loadingStatus' | 'idle' | 'installing' | 'success' | 'error';

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export function TrackingScriptCard() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<TrackingScriptStatusApiResponse | null>(null);
  const [phase, setPhase] = useState<UiPhase>('loadingStatus');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async (currentToken: string) => {
    setPhase('loadingStatus');
    setErrorMessage(null);
    try {
      const res = await ApiRequests.trackingScript.getStatus(currentToken);
      if (res.status === 200 && res.data?.data) {
        setStatus(res.data.data);
        setPhase('idle');
        return;
      }
      setErrorMessage('Kurulum durumu alınamadı');
      setPhase('error');
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string | { message?: string } } };
      };
      const raw = axiosErr.response?.data?.error;
      const message =
        typeof raw === 'string'
          ? raw
          : raw?.message || 'Kurulum durumu alınamadı';
      setErrorMessage(message);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fetched = await TokenHelpers.getTokenForIframeApp();
        if (cancelled) return;
        if (!fetched) {
          setErrorMessage('Oturum bulunamadı');
          setPhase('error');
          return;
        }
        setToken(fetched);
        await fetchStatus(fetched);
      } catch {
        if (!cancelled) {
          setErrorMessage('Oturum başlatılamadı');
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  const handleInstall = useCallback(async () => {
    if (!token || phase === 'installing') return;

    setPhase('installing');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await ApiRequests.trackingScript.install(token);
      if (res.status === 200 && res.data?.data) {
        setSuccessMessage(
          res.data.data.updated
            ? 'Takip scripti güncellendi'
            : 'Takip scripti kuruldu',
        );
        setStatus({
          installed: true,
          scriptId: res.data.data.scriptId,
          storefrontId: res.data.data.storefrontId,
          apiUrl: res.data.data.apiUrl,
          updatedAt: new Date().toISOString(),
        });
        setPhase('success');
        return;
      }
      setErrorMessage('Script kurulumu başarısız');
      setPhase('error');
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string | { message?: string } } };
      };
      const raw = axiosErr.response?.data?.error;
      const message =
        typeof raw === 'string'
          ? raw
          : raw?.message || 'Script kurulumu başarısız';
      setErrorMessage(message);
      setPhase('error');
    }
  }, [token, phase]);

  const installed = Boolean(status?.installed);
  const busy = phase === 'loadingStatus' || phase === 'installing';
  const updatedLabel = formatDate(status?.updatedAt);

  return (
    <section className="rounded-xl border border-border bg-background p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate">
            STOREFRONT
          </p>
          <h2 className="text-lg font-medium text-primary">Ürün görüntülenme takibi</h2>
          <p className="mt-1 max-w-xl text-sm text-slate">
            Müşteri vitrinine takip scriptini yerleştirir. Ürün sayfası açıldığında görüntülenme
            sayıları Flowventory&apos;ye yazılır.
          </p>
        </div>

        <div
          className={
            installed
              ? 'inline-flex shrink-0 items-center rounded-full bg-pale-green px-2.5 py-1 text-xs font-medium text-deep-green'
              : 'inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-slate'
          }
        >
          {phase === 'loadingStatus' ? 'Kontrol ediliyor…' : installed ? 'Kurulu' : 'Kurulu değil'}
        </div>
      </div>

      {installed && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {status?.apiUrl && (
            <div>
              <dt className="text-xs text-slate">Kayıtlı API URL</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-foreground" title={status.apiUrl}>
                {status.apiUrl}
              </dd>
            </div>
          )}
          {updatedLabel && (
            <div>
              <dt className="text-xs text-slate">Son güncelleme</dt>
              <dd className="mt-0.5 text-foreground">{updatedLabel}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-4 text-xs text-slate">
        Dev ortamında tünel URL&apos;si değişirse scripti yeniden kurman gerekir. Daha önce elle
        oluşturulmuş eski scriptler otomatik silinmez.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleInstall}
          disabled={!token || busy}
          className="rounded-full px-5"
        >
          {phase === 'installing' && <Loader2 className="h-4 w-4 animate-spin" />}
          {installed ? 'Yeniden kur' : 'Takip scriptini kur'}
        </Button>

        {phase === 'success' && successMessage && (
          <p className="text-sm text-deep-green">{successMessage}</p>
        )}
        {phase === 'error' && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </div>
    </section>
  );
}
