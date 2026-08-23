'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiRequests } from '@/lib/api-requests';
import { markStoreSynced } from '@/lib/onboarding';
import { SettingsSection } from './SettingsSection';

type UiPhase = 'idle' | 'syncing' | 'success' | 'error';

interface SyncSectionProps {
  token: string;
}

/**
 * Manuel veri senkronizasyonu bölümü. POST /api/sync tüm ürünleri ve son 60
 * günün siparişlerini ikas'tan yeniden çeker; sunucudaki in-flight dedupe
 * sayesinde süren bir senkronla çakışmaz. Başlarken kartındaki "Mağaza verini
 * senkronla" adımı buraya (#veri-senkron) derin bağlanır.
 */
export function SyncSection({ token }: SyncSectionProps) {
  const [phase, setPhase] = useState<UiPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    if (phase === 'syncing') return;

    setPhase('syncing');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await ApiRequests.sync.run(token);
      if (res.status === 200 && res.data?.data) {
        const { productCount, salesDayCount } = res.data.data;
        setSuccessMessage(`${productCount} ürün, ${salesDayCount} günlük satış senkronlandı.`);
        // Sidebar'daki onboarding kartı anında güncellensin.
        markStoreSynced();
        setPhase('success');
        return;
      }
      setErrorMessage('Senkronizasyon başarısız');
      setPhase('error');
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string | { message?: string } } };
      };
      const raw = axiosErr.response?.data?.error;
      const message = typeof raw === 'string' ? raw : raw?.message || 'Senkronizasyon başarısız';
      setErrorMessage(message);
      setPhase('error');
    }
  }, [token, phase]);

  return (
    <SettingsSection
      id="veri-senkron"
      eyebrow="VERİ"
      title="Veri senkronizasyonu"
      description="Ürünler ve son 60 günün siparişleri ikas'tan çekilir; rapor ve analizler bu veriyle hesaplanır."
    >
      <p className="text-pretty text-xs text-muted-foreground">
        Veriler her 30 dakikada bir ve mağaza değişikliklerinde kendiliğinden tazelenir. Bu buton
        beklemeden tam senkron başlatır — ilk kurulumda ya da veriler eski göründüğünde kullanın.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleSync}
          disabled={phase === 'syncing'}
          className="self-start"
        >
          {phase === 'syncing' && <Loader2 className="size-4 animate-spin" />}
          {phase === 'syncing' ? 'Senkronlanıyor…' : 'Şimdi Senkronla'}
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
