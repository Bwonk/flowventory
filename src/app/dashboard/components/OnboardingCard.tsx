'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { ApiRequests } from '@/lib/api-requests';
import { DEFAULT_STOCK_THRESHOLD } from '@/lib/stock-threshold';

const DISMISS_KEY = 'flowventory:onboarding-dismissed';
export const REPORT_VIEWED_KEY = 'flowventory:report-viewed';

interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

/**
 * Kurulum kontrol listesi — yeni kullanıcı boş dashboard'a düşmesin.
 * Üç adım: tracker kur → eşik ayarla → satın alma raporunu gör.
 * Tümü tamamlanınca veya kullanıcı kapatınca görünmez.
 */
export function OnboardingCard({ token }: { token: string | null }) {
  const [dismissed, setDismissed] = useState(true); // SSR flash önleme: kapalı başla
  const [trackerInstalled, setTrackerInstalled] = useState<boolean | null>(null);
  const [thresholdSet, setThresholdSet] = useState(false);
  const [reportViewed, setReportViewed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    setReportViewed(window.localStorage.getItem(REPORT_VIEWED_KEY) === '1');
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    ApiRequests.trackingScript
      .getStatus(token)
      .then(res => {
        if (!cancelled) setTrackerInstalled(Boolean(res.data?.data?.installed));
      })
      .catch(() => {
        if (!cancelled) setTrackerInstalled(false);
      });

    ApiRequests.merchantSettings
      .get(token)
      .then(res => {
        const s = res.data?.data;
        if (!cancelled && s) {
          setThresholdSet(
            s.criticalThreshold !== DEFAULT_STOCK_THRESHOLD.min ||
              s.warningThreshold !== DEFAULT_STOCK_THRESHOLD.max,
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Tracker durumu henüz bilinmiyorsa titreme olmasın diye bekle.
  if (dismissed || trackerInstalled === null) return null;

  const steps: OnboardingStep[] = [
    {
      key: 'tracker',
      title: 'Takip scriptini kur',
      description: 'Ürün görüntülenmelerini toplamak için mağazana scripti ekle.',
      href: '/dashboard/ayarlar',
      done: trackerInstalled,
    },
    {
      key: 'threshold',
      title: 'Stok eşiklerini ayarla',
      description: 'Kritik ve az kalan seviyelerini mağazana göre belirle.',
      href: '/dashboard/stok',
      done: thresholdSet,
    },
    {
      key: 'report',
      title: 'Satın alma raporunu incele',
      description: 'Tedarikçi bazlı sipariş önerilerini gör.',
      href: '/dashboard/rapor',
      done: reportViewed,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section className="mb-4 rounded-xl border border-border bg-background p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">BAŞLARKEN</p>
          <h2 className="mt-0.5 text-sm font-medium text-foreground">
            Kurulumu tamamla ({doneCount}/{steps.length})
          </h2>
        </div>
        <button
          type="button"
          aria-label="Kurulum kartını kapat"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`flex h-full items-start gap-3 rounded-lg border p-3 transition-colors ${
                step.done
                  ? 'border-border bg-muted/50'
                  : 'border-border hover:border-hairline hover:bg-muted/30'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.done ? 'bg-pale-green text-deep-green' : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {step.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{step.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
