'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiRequests } from '@/lib/api-requests';
import { markTrackerInstalled } from '@/lib/onboarding';
import type { TrackingScriptStatusApiResponse } from '@/app/api/tracking-script/status/route';
import { SettingsSection } from './SettingsSection';

type UiPhase = 'idle' | 'installing' | 'success' | 'error';

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

interface TrackingScriptSectionProps {
  token: string;
  initialStatus: TrackingScriptStatusApiResponse | null;
}

/**
 * Storefront takip scripti bölümü. Durum/veri fetch'i sayfa hook'unda
 * (use-ayarlar-data); burada yalnızca kurulum mutasyonu ve render var.
 */
export function TrackingScriptSection({ token, initialStatus }: TrackingScriptSectionProps) {
  const [status, setStatus] = useState<TrackingScriptStatusApiResponse | null>(initialStatus);
  const [phase, setPhase] = useState<UiPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleInstall = useCallback(async () => {
    if (phase === 'installing') return;

    setPhase('installing');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await ApiRequests.trackingScript.install(token);
      if (res.status === 200 && res.data?.data) {
        setSuccessMessage(
          res.data.data.updated ? 'Takip scripti güncellendi' : 'Takip scripti kuruldu',
        );
        setStatus({
          installed: true,
          scriptId: res.data.data.scriptId,
          storefrontId: res.data.data.storefrontId,
          apiUrl: res.data.data.apiUrl,
          updatedAt: new Date().toISOString(),
        });
        // Sidebar'daki onboarding kartı anında güncellensin.
        markTrackerInstalled();
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
        typeof raw === 'string' ? raw : raw?.message || 'Script kurulumu başarısız';
      setErrorMessage(message);
      setPhase('error');
    }
  }, [token, phase]);

  const installed = Boolean(status?.installed);
  const updatedLabel = formatDate(status?.updatedAt);

  return (
    <SettingsSection
      eyebrow="STOREFRONT"
      title="Ürün görüntülenme takibi"
      description="Müşteri vitrinine takip scriptini yerleştirir. Ürün sayfası açıldığında görüntülenme sayıları Flowventory'ye yazılır."
    >
      <div className="flex min-h-10 items-center gap-2">
        <span
          className={
            installed
              ? 'size-2 rounded-full bg-status-healthy'
              : 'size-2 rounded-full bg-status-warning'
          }
          aria-hidden
        />
        <span className="text-sm font-medium text-foreground">
          {installed ? 'Kurulu' : 'Kurulu değil'}
        </span>
      </div>

      {installed && (status?.apiUrl || updatedLabel) && (
        <dl className="rounded-md bg-muted p-3">
          {status?.apiUrl && (
            <div className="flex items-baseline justify-between gap-4 py-1">
              <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Kayıtlı API URL
              </dt>
              <dd className="min-w-0 truncate font-mono text-xs text-foreground" title={status.apiUrl}>
                {status.apiUrl}
              </dd>
            </div>
          )}
          {updatedLabel && (
            <div className="flex items-baseline justify-between gap-4 py-1">
              <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Son güncelleme
              </dt>
              <dd className="font-mono text-xs tabular-nums text-foreground">{updatedLabel}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="text-pretty text-xs text-muted-foreground">
        Dev ortamında tünel URL&apos;si değişirse scripti yeniden kurman gerekir. Daha önce elle
        oluşturulmuş eski scriptler otomatik silinmez.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleInstall}
          disabled={phase === 'installing'}
          className="self-start"
        >
          {phase === 'installing' && <Loader2 className="size-4 animate-spin" />}
          {installed ? 'Yeniden kur' : 'Takip scriptini kur'}
        </Button>

        <span aria-live="polite">
          {phase === 'success' && successMessage && (
            <span className="text-sm text-status-healthy">{successMessage}</span>
          )}
          {phase === 'error' && errorMessage && (
            <span className="text-sm text-destructive">{errorMessage}</span>
          )}
        </span>
      </div>
    </SettingsSection>
  );
}
