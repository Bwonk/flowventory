'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { PurchaseReportApiResponse } from '@/app/api/reports/purchase/route';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { useMerchantCurrency } from '@/lib/currency';
import { markReportViewed, markStoreSynced } from '@/lib/onboarding';
import { RaporSkeleton } from './_components/RaporSkeleton';
import { ContentFadeIn } from '@/components/motion/content-fade-in';
import { basketFromReport, clampQty, seedBasket, type BasketState } from './_components/basket';
import { DraftSyncContext, useDraftSync } from './_components/use-draft-sync';
import { ReportActionBar } from './_components/ReportActionBar';
import { InfoTip } from '@/components/shared/InfoTip';
import { ReportKpiStrip } from './_components/ReportKpiStrip';
import { VendorTabsPanel } from './_components/VendorTabsPanel';
import type { VendorListItem } from '@/app/api/vendors/route';

/**
 * Satın Alma Raporu sayfası.
 *
 * Üstte KPI şeridi, altında tedarikçi tab'lı tek panel; leadTime/hedef gün
 * ayarları buradan güncellenebilir. "Yazdır" tarayıcının print → PDF akışını
 * kullanır (Türkçe karakter sorunları olmadığı için jspdf yerine print CSS
 * tercih edildi).
 */
export default function RaporPage() {
  // Mağaza para birimini tazeler; formatPrice aktif kodu okur.
  useMerchantCurrency();
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<PurchaseReportApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sepet (variantId → adet) = tedarikçi taslaklarının istemci kopyası: tablo
  // tikleri ekler/çıkarır, çekmece düzenler; her değişiklik sunucuya yazılır.
  const [basket, setBasket] = useState<BasketState>({});
  const draftSync = useDraftSync(token);

  const handleLineQtyChange = useCallback(
    (variantId: string, qty: number | null) => {
      const next = qty === null ? null : clampQty(qty);
      setBasket(prev => {
        if (next === null) {
          if (!(variantId in prev)) return prev;
          const copy = { ...prev };
          delete copy[variantId];
          return copy;
        }
        return { ...prev, [variantId]: next };
      });
      draftSync.queue(variantId, next);
    },
    [draftSync],
  );

  // "Önerilere sıfırla": taslaklar güncel önerilerle değiştirilir.
  const handleResetBasket = useCallback(() => {
    if (!report) return;
    const seeded = seedBasket(report);
    for (const variantId of Object.keys(basket)) {
      if (!(variantId in seeded)) draftSync.queue(variantId, null);
    }
    for (const [variantId, qty] of Object.entries(seeded)) draftSync.queue(variantId, qty);
    setBasket(seeded);
  }, [report, basket, draftSync]);

  // Atama popover'ındaki mevcut tedarikçi listesi; hatası ölümcül değil
  // (boş liste de serbest metinle eklemeye izin verir).
  const [vendorList, setVendorList] = useState<VendorListItem[]>([]);

  // Aktif tedarikçi tab'ı (vendorId ?? 'none'). Geçerliliği panel içinde
  // türetilerek denetlenir: seçili tedarikçi kaybolursa ilk tab'a düşülür.
  const [activeVendorKey, setActiveVendorKey] = useState<string | null>(null);

  // Ürün Ekle sonrası aktif tab'ı adıyla yeniden hedefle: local- id ilk
  // atamada gerçek ikas id'sine dönüştüğü için key değişir, tab zıplamasın.
  const [pendingVendorName, setPendingVendorName] = useState<string | null>(null);

  // Tek tedarikçi yazdırma: doluyken diğer tablar ve özet print'te gizlenir.
  // afterprint (iptalde de tetiklenir) durumu sıfırlar; rAF class'ların
  // print'ten önce flush olmasını garantiler.
  const [printVendorId, setPrintVendorId] = useState<string | null>(null);

  useEffect(() => {
    const reset = () => setPrintVendorId(null);
    window.addEventListener('afterprint', reset);
    return () => window.removeEventListener('afterprint', reset);
  }, []);

  useEffect(() => {
    if (printVendorId === null) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printVendorId]);

  const fetchReport = useCallback(async (currentToken: string): Promise<boolean> => {
    try {
      // Bekleyen tik/adet yazımı rapordan önce bitsin; yoksa taslak eski hâliyle döner.
      await draftSync.flush();
      const [res, vendorsRes] = await Promise.all([
        ApiRequests.reports.purchase(currentToken),
        ApiRequests.vendors.list(currentToken).catch(error => {
          logger.error('Vendor list fetch failed', { error });
          return null;
        }),
      ]);
      if (vendorsRes?.status === 200 && vendorsRes.data?.data) {
        setVendorList(vendorsRes.data.data.vendors);
      } else {
        // Liste gelmezse kayıtlı e-postalar da görünmez; sessiz kalmasın.
        toast.error('Tedarikçi iletişim bilgileri yüklenemedi. Yenile ile tekrar deneyin.');
      }
      if (res.status === 200 && res.data?.data) {
        setReport(res.data.data);
        setBasket(basketFromReport(res.data.data));
        // Rapor üretildiyse sunucu ensureFreshSync'i çalıştırmıştır —
        // Başlarken'deki "Mağaza verini senkronla" adımı kendiliğinden biter.
        markStoreSynced();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error fetching purchase report', { error });
      return false;
    }
  }, [draftSync]);

  // Gönderilen siparişin satırları taslaktan çıktı; rapor yeniden hesaplanır ki
  // adetler "Yolda" sütununa geçsin ve öneriden düşsün.
  const handleVendorSent = useCallback(
    (vendorId: string) => {
      const vendor = report?.vendors.find(v => v.vendorId === vendorId);
      if (vendor) {
        const ids = vendor.lines.map(l => l.variantId);
        draftSync.drop(ids);
        setBasket(prev => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        });
      }
      if (token) void fetchReport(token);
    },
    [report, draftSync, token, fetchReport],
  );

  // Yolda çekmecesindeki teslim alma / iptal / geri al → stok ve yolda değişti.
  const handleOrdersChanged = useCallback(() => {
    if (token) void fetchReport(token);
  }, [token, fetchReport]);

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
    markReportViewed();
  }, []);

  // Parametre popover'ından: kaydet + raporu yeniden hesapla. Hata yönetimi
  // (log + popover'ı açık bırakma) çağıran bileşende.
  const applySettings = useCallback(
    async (leadTimeDays: number, targetStockDays: number) => {
      if (!token) return;
      await ApiRequests.merchantSettings.update(token, { leadTimeDays, targetStockDays });
      await fetchReport(token);
    },
    [token, fetchReport],
  );

  const handleVendorContactSaved = useCallback(
    (vendorId: string, next: Partial<Omit<VendorListItem, 'vendorId' | 'vendorName'>>) => {
      setVendorList(prev => {
        if (prev.some(v => v.vendorId === vendorId)) {
          return prev.map(v => (v.vendorId === vendorId ? { ...v, ...next } : v));
        }
        // Liste yüklenememişse ya da tedarikçi henüz listede yoksa kaydı kaybetme.
        const vendorName = report?.vendors.find(v => v.vendorId === vendorId)?.vendorName;
        if (!vendorName) return prev;
        const empty = { email: null, phone: null, leadTimeDays: null, moq: null, casePack: null };
        return [...prev, { vendorId, vendorName, ...empty, ...next }].sort((a, b) =>
          a.vendorName.localeCompare(b.vendorName, 'tr'),
        );
      });
      // Tedarik süresi / MOQ / koli öneriyi değiştirir: rapor yeniden hesaplanır.
      if (token && ('leadTimeDays' in next || 'moq' in next || 'casePack' in next)) void fetchReport(token);
    },
    [report, token, fetchReport],
  );

  const handleVendorDeleted = useCallback((vendorId: string) => {
    setVendorList(prev => prev.filter(v => v.vendorId !== vendorId));
    // Silinen tab aktifse panel ilk tab'a düşer (effectiveActiveKey fallback'i).
  }, []);

  const handleAssigned = useCallback(async () => {
    if (!token) return;
    await fetchReport(token);
  }, [token, fetchReport]);

  const handleProductsAssigned = useCallback(
    async (vendorName: string) => {
      if (!token) return;
      await fetchReport(token);
      setPendingVendorName(vendorName);
    },
    [token, fetchReport],
  );

  useEffect(() => {
    if (pendingVendorName === null) return;
    const lowered = pendingVendorName.toLocaleLowerCase('tr');
    const inReport = report?.vendors.find(v => v.vendorName.toLocaleLowerCase('tr') === lowered);
    const inList = vendorList.find(v => v.vendorName.toLocaleLowerCase('tr') === lowered);
    const key = inReport ? (inReport.vendorId ?? 'none') : inList?.vendorId;
    if (key) setActiveVendorKey(key);
    setPendingVendorName(null);
  }, [pendingVendorName, report, vendorList]);

  if (loading) return <RaporSkeleton />;
  if (error) return <ErrorState description={error} onRetry={initialize} />;
  if (!report) return null;

  const generatedAt = new Date(report.generatedAt);

  // Tab kaynağı: rapor tedarikçileri (ürünü olan herkes) ∪ henüz ürünsüz
  // kayıtlar (yeni eklenen local- tedarikçiler dahil) — tab anında oluşur.
  const reportVendorIds = new Set(report.vendors.map(v => v.vendorId));
  const reportVendorNames = new Set(report.vendors.map(v => v.vendorName.toLocaleLowerCase('tr')));
  const displayVendors = [
    ...report.vendors,
    ...vendorList
      .filter(
        v =>
          !reportVendorIds.has(v.vendorId) &&
          !reportVendorNames.has(v.vendorName.toLocaleLowerCase('tr')),
      )
      .map(v => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        lines: [],
        totalCost: 0,
        hasEstimate: false,
        leadTimeDays: v.leadTimeDays ?? report.leadTimeDays,
        moq: v.moq,
        casePack: v.casePack,
      })),
  ];

  return (
    <DraftSyncContext.Provider value={draftSync}>
    <ContentFadeIn>
      <PageContainer className="print:max-w-none print:p-0">
        <PageHeader
          eyebrow="RAPOR"
          title="Satın Alma Raporu"
          // Açıklama satırı yerine başlık yanındaki "i" balonu — araç yolu açılınca
          // üstüne gelecek metin kalmaz; bilgi istendiğinde bir hover uzakta.
          titleAccessory={
            <InfoTip
              ariaPrefix="Rapor bilgisi"
              text={`Son ${report.salesWindowDays} günün satış hızına göre · ${generatedAt.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}`}
            />
          }
          // Sayfa araçları kompakt ikon yolunda (DESIGN.md §5 "Araç yolu"); print'te gizli.
          actions={
            <ReportActionBar
              token={token}
              leadTimeDays={report.leadTimeDays}
              targetStockDays={report.targetStockDays}
              onApplySettings={applySettings}
              onVendorCreated={vendor => {
                setVendorList(prev =>
                  [...prev, vendor].sort((a, b) => a.vendorName.localeCompare(b.vendorName, 'tr')),
                );
                // Yeni tedarikçinin tab'ı anında oluşur ve aktif olur.
                setActiveVendorKey(vendor.vendorId);
              }}
              onRefresh={initialize}
              vendors={displayVendors}
              vendorList={vendorList}
              basket={basket}
              onLineQtyChange={handleLineQtyChange}
              onResetBasket={handleResetBasket}
              onVendorSent={handleVendorSent}
              onVendorContactSaved={handleVendorContactSaved}
              openOrderCount={report.openOrderCount}
              onOrdersChanged={handleOrdersChanged}
              onPrint={() => window.print()}
            />
          }
        />

        {/* Özet — tek tedarikçi yazdırmada çıktıya girmez */}
        <ReportKpiStrip
          report={report}
          vendorCount={displayVendors.filter(v => v.vendorId !== null).length}
          printVendorId={printVendorId}
        />

        {displayVendors.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-hairline bg-card px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">Sipariş önerisi yok</p>
            <p className="text-xs text-muted-foreground">
              Satış hızı ve mevcut stok seviyelerine göre şu an sipariş gerektiren ürün bulunmuyor.
            </p>
          </div>
        ) : (
          <VendorTabsPanel
            vendors={displayVendors}
            token={token}
            vendorList={vendorList}
            basket={basket}
            onLineQtyChange={handleLineQtyChange}
            onVendorSent={handleVendorSent}
            onAssigned={handleAssigned}
            onProductsAssigned={handleProductsAssigned}
            onVendorContactSaved={handleVendorContactSaved}
            onVendorDeleted={handleVendorDeleted}
            activeKey={activeVendorKey}
            onActiveKeyChange={setActiveVendorKey}
            printVendorId={printVendorId}
            onPrintVendor={setPrintVendorId}
          />
        )}

        {/* Print altbilgisi */}
        <p className="hidden text-xs text-muted-foreground print:block">
          Flowventory satın alma raporu · {generatedAt.toLocaleString('tr-TR')} · Tedarik süresi {report.leadTimeDays} gün,
          hedef stok {report.targetStockDays} gün. Alış fiyatı tanımlı olmayan ürünlerde satış fiyatı kullanılmıştır.
        </p>
      </PageContainer>
    </ContentFadeIn>
    </DraftSyncContext.Provider>
  );
}
