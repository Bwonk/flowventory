'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { PurchaseReportApiResponse } from '@/app/api/reports/purchase/route';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { useMerchantCurrency } from '@/lib/currency';
import { markReportViewed, markStoreSynced } from '@/lib/onboarding';
import { RaporSkeleton } from './_components/RaporSkeleton';
import { clampQty, seedBasket, type BasketState } from './_components/basket';
import { ReportActionBar } from './_components/ReportActionBar';
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

  // Tek tık stok girişi sonrası Stok hücresi override'ları (variantId → yeni toplam).
  // Öneri/toplamlar yeniden hesaplanmaz; "Yenile" sunucuda tazeler.
  const [stockOverrides, setStockOverrides] = useState<Record<string, number>>({});

  const handleStockChange = useCallback((variantId: string, newTotalStock: number) => {
    setStockOverrides(prev => ({ ...prev, [variantId]: newTotalStock }));
  }, []);

  // Sepet (variantId → adet): tablo tikleri ekler/çıkarır, çekmece düzenler.
  // Geçicidir — "Yenile"/refetch güncel önerilerin varsayılanıyla yeniden kurar.
  const [basket, setBasket] = useState<BasketState>({});

  const handleLineQtyChange = useCallback((variantId: string, qty: number | null) => {
    setBasket(prev => {
      if (qty === null) {
        if (!(variantId in prev)) return prev;
        const next = { ...prev };
        delete next[variantId];
        return next;
      }
      return { ...prev, [variantId]: clampQty(qty) };
    });
  }, []);

  const handleResetBasket = useCallback(() => {
    setBasket(report ? seedBasket(report) : {});
  }, [report]);

  // Gönderim başarısında o tedarikçinin satırları sepetten düşer — gönderilen
  // sipariş "tamamlandı" sayılır; Yenile öneriyi güncel stokla tazeler.
  const handleVendorSent = useCallback(
    (vendorId: string) => {
      const vendor = report?.vendors.find(v => v.vendorId === vendorId);
      if (!vendor) return;
      setBasket(prev => {
        const next = { ...prev };
        for (const line of vendor.lines) delete next[line.variantId];
        return next;
      });
    },
    [report],
  );

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
      const [res, vendorsRes] = await Promise.all([
        ApiRequests.reports.purchase(currentToken),
        ApiRequests.vendors.list(currentToken).catch(() => null),
      ]);
      if (vendorsRes?.status === 200 && vendorsRes.data?.data) {
        setVendorList(vendorsRes.data.data.vendors);
      }
      if (res.status === 200 && res.data?.data) {
        setReport(res.data.data);
        setStockOverrides({});
        setBasket(seedBasket(res.data.data));
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
    (vendorId: string, next: { email: string | null; phone: string | null }) => {
      setVendorList(prev => prev.map(v => (v.vendorId === vendorId ? { ...v, ...next } : v)));
    },
    [],
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
      })),
  ];

  return (
    <PageContainer className="print:max-w-none print:p-0">
      <PageHeader
        eyebrow="RAPOR"
        title="Satın Alma Raporu"
        description={`Son ${report.salesWindowDays} günün satış hızına göre · ${generatedAt.toLocaleString('tr-TR')}`}
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
          stockOverrides={stockOverrides}
          onStockChange={handleStockChange}
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
  );
}
