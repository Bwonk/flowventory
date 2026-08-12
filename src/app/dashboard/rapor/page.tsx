'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, Printer, RefreshCw } from 'lucide-react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { PurchaseReportApiResponse } from '@/app/api/reports/purchase/route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { formatPrice, useMerchantCurrency } from '@/lib/currency';
import { RaporSkeleton } from './_components/RaporSkeleton';

/**
 * Satın Alma Raporu sayfası.
 *
 * Tedarikçi bazlı gruplanmış sipariş önerileri; leadTime/hedef gün ayarları
 * buradan güncellenebilir. "Yazdır" tarayıcının print → PDF akışını kullanır
 * (Türkçe karakter sorunları olmadığı için jspdf yerine print CSS tercih edildi).
 */
export default function RaporPage() {
  // Mağaza para birimini tazeler; formatPrice aktif kodu okur.
  useMerchantCurrency();
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<PurchaseReportApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ayar taslakları (kaydedilince rapor yeniden hesaplanır)
  const [leadTimeDraft, setLeadTimeDraft] = useState<number | null>(null);
  const [targetDaysDraft, setTargetDaysDraft] = useState<number | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchReport = useCallback(async (currentToken: string): Promise<boolean> => {
    try {
      const res = await ApiRequests.reports.purchase(currentToken);
      if (res.status === 200 && res.data?.data) {
        setReport(res.data.data);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error fetching purchase report', { error });
      return false;
    }
  }, []);

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
      const ok = await fetchReport(fetchedToken);
      if (!ok) setError('Rapor oluşturulamadı.');
    } catch (error) {
      logger.error('Error initializing report page', { error });
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [fetchReport]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Onboarding: "raporu incele" adımını tamamlandı olarak işaretle.
  useEffect(() => {
    try {
      window.localStorage.setItem('flowventory:report-viewed', '1');
    } catch {
      // localStorage erişilemezse sessiz geç.
    }
  }, []);

  const saveSettings = useCallback(async () => {
    if (!token || !report) return;
    setSavingSettings(true);
    try {
      await ApiRequests.merchantSettings.update(token, {
        ...(leadTimeDraft !== null ? { leadTimeDays: leadTimeDraft } : {}),
        ...(targetDaysDraft !== null ? { targetStockDays: targetDaysDraft } : {}),
      });
      setLeadTimeDraft(null);
      setTargetDaysDraft(null);
      await fetchReport(token);
    } catch (error) {
      logger.error('Error saving report settings', { error });
    } finally {
      setSavingSettings(false);
    }
  }, [token, report, leadTimeDraft, targetDaysDraft, fetchReport]);

  if (loading) return <RaporSkeleton />;
  if (error) return <ErrorState description={error} onRetry={initialize} />;
  if (!report) return null;

  const leadTime = leadTimeDraft ?? report.leadTimeDays;
  const targetDays = targetDaysDraft ?? report.targetStockDays;
  const settingsDirty = leadTimeDraft !== null || targetDaysDraft !== null;
  const generatedAt = new Date(report.generatedAt);

  return (
    <PageContainer className="print:max-w-none print:p-0">
      <PageHeader
        eyebrow="RAPOR"
        title="Satın Alma Raporu"
        description={`Son ${report.salesWindowDays} günün satış hızına göre · ${generatedAt.toLocaleString('tr-TR')}`}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={initialize} className="gap-1.5">
              <RefreshCw className="size-3" aria-hidden />
              Yenile
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              disabled={report.lineCount === 0}
              className="gap-1.5"
            >
              <Printer className="size-3" aria-hidden />
              Yazdır / PDF
            </Button>
          </div>
        }
      />

      {/* Parametreler */}
      <section className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-hairline bg-card p-4 print:hidden">
        <div>
          <label htmlFor="leadTime" className="mb-1 block text-xs text-muted-foreground">
            Tedarik süresi (gün)
          </label>
          <Input
            id="leadTime"
            type="number"
            min={0}
            max={365}
            value={leadTime}
            onChange={e => setLeadTimeDraft(Math.max(0, Number(e.target.value) || 0))}
            className="w-24"
          />
        </div>
        <div>
          <label htmlFor="targetDays" className="mb-1 block text-xs text-muted-foreground">
            Hedef stok (gün)
          </label>
          <Input
            id="targetDays"
            type="number"
            min={1}
            max={365}
            value={targetDays}
            onChange={e => setTargetDaysDraft(Math.max(1, Number(e.target.value) || 1))}
            className="w-24"
          />
        </div>
        <Button onClick={saveSettings} disabled={!settingsDirty || savingSettings}>
          {savingSettings ? 'Hesaplanıyor…' : 'Uygula'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Öneri = günlük satış × (hedef + tedarik süresi) + emniyet stoğu − mevcut stok, 5&apos;in katına yuvarlanır.
        </p>
      </section>

      {/* Özet */}
      <section className="mb-4 rounded-lg border border-hairline bg-card overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'TOPLAM MALİYET', value: formatPrice(report.totalCost) },
            { label: 'SİPARİŞ SATIRI', value: `${report.lineCount}` },
            { label: 'ACİL', value: `${report.urgentCount}`, highlight: report.urgentCount > 0 },
            { label: 'TEDARİKÇİ', value: `${report.vendors.length}` },
          ].map(item => (
            <div key={item.label} className="border-b border-r border-border p-4 last:border-r-0 lg:border-b-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={`mt-1 font-mono text-xl font-medium tabular-nums xl:text-2xl ${item.highlight ? 'text-destructive' : 'text-foreground'}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {report.lineCount === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-hairline bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Sipariş önerisi yok</p>
          <p className="text-xs text-muted-foreground">
            Satış hızı ve mevcut stok seviyelerine göre şu an sipariş gerektiren ürün bulunmuyor.
          </p>
        </div>
      ) : (
        report.vendors.map(vendor => (
          <section
            key={vendor.vendorId ?? 'none'}
            className="mb-4 overflow-hidden rounded-lg border border-hairline bg-card print:break-inside-avoid"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">{vendor.vendorName}</h2>
                <p className="text-xs text-muted-foreground">{vendor.lines.length} ürün</p>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatPrice(vendor.totalCost)}
                {vendor.hasEstimate && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground" title="Bazı satırlarda alış fiyatı yok; satış fiyatı kullanıldı">
                    ~tahmini
                  </span>
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2 font-normal">Ürün</th>
                    <th className="px-3 py-2 font-normal">SKU</th>
                    <th className="px-3 py-2 text-right font-normal">Stok</th>
                    <th className="px-3 py-2 text-right font-normal">Günlük Satış</th>
                    <th className="px-3 py-2 text-right font-normal">Sipariş Noktası</th>
                    <th className="px-3 py-2 text-right font-normal">Öneri</th>
                    <th className="px-3 py-2 text-right font-normal">Birim</th>
                    <th className="px-5 py-2 text-right font-normal">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.lines.map(line => (
                    <tr key={line.variantId} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {line.imageUrl && (
                            <Image
                              src={line.imageUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="h-7 w-7 shrink-0 rounded object-cover print:hidden"
                              unoptimized
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {line.productName}
                              {line.urgent && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive align-middle">
                                  <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                                  acil
                                </span>
                              )}
                            </p>
                            {line.variantName && (
                              <p className="truncate text-xs text-muted-foreground">{line.variantName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{line.sku ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{line.currentStock}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{line.dailyAvg.toLocaleString('tr-TR')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{line.reorderPoint}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{line.suggestedQty}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatPrice(line.unitCost)}
                        {line.isEstimate && <span className="text-xs text-muted-foreground" title="Alış fiyatı tanımlı değil">~</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium tabular-nums">{formatPrice(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {/* Print altbilgisi */}
      <p className="hidden text-xs text-muted-foreground print:block">
        Flowventory satın alma raporu · {generatedAt.toLocaleString('tr-TR')} · Tedarik süresi {report.leadTimeDays} gün,
        hedef stok {report.targetStockDays} gün. ~ işaretli tutarlar alış fiyatı yerine satış fiyatıyla hesaplanmıştır.
      </p>
    </PageContainer>
  );
}
