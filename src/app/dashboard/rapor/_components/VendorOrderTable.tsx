'use client';

import { useCallback, useMemo } from 'react';
import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, type SelectionChange, type TableColumn } from '@/components/motion/table';
import { RowActions } from '@/components/shared/data-table/RowActions';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportLine, PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import { InfoTip } from '@/components/shared/InfoTip';
import { NumberStepper } from '@/components/shared/NumberStepper';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import { ORDER_ROUNDING_MULTIPLE } from '@/lib/reports/purchase';
import { defaultQtyFor, MAX_ORDER_QTY, type BasketState } from './basket';
import { VendorAssignPopover } from './VendorAssignPopover';

interface VendorOrderTableProps {
  vendor: PurchaseReportVendor;
  token: string | null;
  vendors: VendorListItem[];
  onAssigned: () => Promise<void>;
  /** Sepet = tedarikçi taslağı: tikli satırlar ve adetleri. */
  basket: BasketState;
  onLineQtyChange: (variantId: string, qty: number | null) => void;
}

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

/** "Bugün" / "Gecikti" / "12 Eki" — en geç sipariş günü. */
function orderByLabel(days: number): string {
  if (days < 0) return 'Gecikti';
  if (days === 0) return 'Bugün';
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/** Öneri balonu: sayının nereden geldiği tek cümlede (Prediko ✨ / IP "details" kalıbı). */
function suggestionExplanation(line: PurchaseReportLine, vendor: PurchaseReportVendor): string {
  const parts = [
    `Günlük ${fmt(line.dailyAvg)} satış (stoklu ${line.inStockDays} gün)`,
    `sipariş noktası ${line.reorderPoint}`,
    `ihtiyaç ${line.rawQty} = hedef seviye − stok ${line.currentStock}${line.incoming > 0 ? ` − yolda ${line.incoming}` : ''}`,
  ];
  const rounding = [vendor.moq ? `MOQ ${vendor.moq}` : null, `koli ${vendor.casePack ?? ORDER_ROUNDING_MULTIPLE}`]
    .filter(Boolean)
    .join(', ');
  return `${parts.join(' · ')} → ${rounding} ile ${line.suggestedQty}. Tedarik ${vendor.leadTimeDays} gün.`;
}

/**
 * Tek tedarikçinin sipariş önerisi tablosu — DESIGN.md §5 "Liste kalıbı".
 * Tik = tedarikçi taslağına ekle (kalıcı); tikli satırda adet satır içinde
 * düzenlenir. Öneri stok + yolda sipariş noktasına inince başlar; "45 → 50"
 * ham ihtiyacı ve MOQ/koli yuvarlamasını gösterir, hesap bilgi balonunda.
 * Stok yalnız teslim almada yazılır (Yolda çekmecesi) — satırda stok butonu yok.
 */
export function VendorOrderTable({ vendor, token, vendors, onAssigned, basket, onLineQtyChange }: VendorOrderTableProps) {
  const selectedRowIds = useMemo(
    () => vendor.lines.filter(line => line.variantId in basket).map(line => line.variantId),
    [vendor.lines, basket],
  );
  const lineById = useMemo(() => new Map(vendor.lines.map(line => [line.variantId, line])), [vendor.lines]);

  // Seçim taslağı sürer: eklenen satır varsayılan adetle girer, çıkan düşer.
  const handleSelectionChange = useCallback(
    (_ids: string[], { added, removed }: SelectionChange) => {
      for (const id of added) {
        const line = lineById.get(id);
        if (line) onLineQtyChange(id, defaultQtyFor(line, vendor.casePack));
      }
      for (const id of removed) onLineQtyChange(id, null);
    },
    [lineById, onLineQtyChange, vendor.casePack],
  );
  const columns = useMemo<TableColumn<PurchaseReportLine>[]>(
    () => [
      {
        key: 'product',
        header: 'Ürün',
        sortable: true,
        minWidth: 220,
        sortValue: line => line.productName,
        cell: line => (
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
                  <Badge variant="critical" className="ml-1.5 align-middle" title="Stok + yolda, tedarik süresince satışı karşılamıyor">
                    <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                    Acil
                  </Badge>
                )}
              </p>
              {line.variantName && <p className="truncate text-xs text-muted-foreground">{line.variantName}</p>}
            </div>
          </div>
        ),
      },
      {
        key: 'stock',
        header: 'Stok',
        sortable: true,
        numeric: true,
        width: '72px',
        sortValue: line => line.currentStock,
        cell: line => line.currentStock,
      },
      {
        key: 'incoming',
        header: 'Yolda',
        sortable: true,
        numeric: true,
        width: '88px',
        sortValue: line => (line.incoming > 0 ? line.incoming : null),
        cell: line =>
          line.incoming > 0 ? (
            <div className="leading-tight">
              <p>{line.incoming}</p>
              {line.incomingExpectedAt && (
                <p className="text-[11px] text-muted-foreground">{shortDate(line.incomingExpectedAt)}</p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'cover',
        header: 'Tükenme',
        sortable: true,
        width: '104px',
        printHidden: true,
        sortValue: line => line.daysOfCover,
        cell: line => (
          <StockLifeBadge
            days={line.daysOfCover === null ? null : Math.floor(line.daysOfCover)}
            title={line.daysOfCover === null ? 'Son 30 günde satış yok' : 'Eldeki stok bu kadar gün yeter'}
          />
        ),
      },
      {
        key: 'orderBy',
        header: 'En geç sipariş',
        sortable: true,
        width: '124px',
        printHidden: true,
        sortValue: line => line.orderInDays,
        cell: line =>
          line.orderInDays === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(line.orderInDays <= 0 ? 'font-medium text-destructive' : 'text-foreground')}
              title="Stok + yolda bitmeden, tedarik süresi hesaba katılarak"
            >
              {orderByLabel(line.orderInDays)}
            </span>
          ),
      },
      {
        key: 'suggested',
        header: 'Öneri',
        sortable: true,
        numeric: true,
        width: '112px',
        sortValue: line => (line.needsOrder ? line.suggestedQty : null),
        cell: line =>
          line.needsOrder ? (
            <span className="inline-flex items-center justify-end gap-1">
              {line.rawQty !== line.suggestedQty && <span className="text-muted-foreground">{line.rawQty} →</span>}
              {line.suggestedQty}
              <InfoTip size="sm" side="left" ariaPrefix="Öneri hesabı" text={suggestionExplanation(line, vendor)} className="print:hidden" />
            </span>
          ) : (
            <span className="text-muted-foreground" title="Stok + yolda sipariş noktasının üstünde">
              —
            </span>
          ),
      },
      {
        // Taslaktaki adet satır içinde düzenlenir; tiksiz satırda boş.
        key: 'qty',
        header: 'Adet',
        numeric: true,
        width: '112px',
        cell: line =>
          line.variantId in basket ? (
            <span className="inline-flex justify-end" onClick={e => e.stopPropagation()}>
              <span className="hidden print:inline">{basket[line.variantId]}</span>
              <NumberStepper
                size="sm"
                value={basket[line.variantId]}
                min={1}
                max={MAX_ORDER_QTY}
                onChange={next => onLineQtyChange(line.variantId, next)}
                onRemove={() => onLineQtyChange(line.variantId, null)}
                label={`${line.productName} sipariş adedi`}
                className="print:hidden"
              />
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'total',
        header: 'Tutar',
        sortable: true,
        numeric: true,
        width: '112px',
        cellClassName: line => (line.isEstimate ? 'cursor-help' : undefined),
        sortValue: line => (line.variantId in basket ? basket[line.variantId] * line.unitCost : null),
        cell: line =>
          line.variantId in basket ? (
            <span
              title={
                line.isEstimate
                  ? `Alış fiyatı tanımlı değil; satış fiyatıyla tahmini (birim ${formatPrice(line.unitCost)}). Tedarikçiye fiyatsız gider.`
                  : `Birim ${formatPrice(line.unitCost)}`
              }
            >
              {formatPrice(basket[line.variantId] * line.unitCost)}
              {line.isEstimate && <span className="text-muted-foreground">*</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">İşlem</span>,
        align: 'right',
        width: '56px',
        printHidden: true,
        cell: line => {
          if (!token || vendor.vendorId !== null) return null;
          return (
            <RowActions>
              <VendorAssignPopover token={token} productId={line.productId} vendors={vendors} onAssigned={onAssigned} />
            </RowActions>
          );
        },
      },
    ],
    [basket, token, vendors, vendor, onAssigned, onLineQtyChange],
  );

  return (
    <Table
      data={vendor.lines}
      columns={columns}
      getRowId={line => line.variantId}
      rowHeight={49}
      // Tedarikçisiz ürün taslağa giremez: önce satırdaki "Tedarikçi ata".
      selectable={vendor.vendorId !== null}
      selectedRowIds={selectedRowIds}
      onSelectionChange={handleSelectionChange}
      selectionLabel={line => `${line.productName} taslağa ekle`}
      selectAllLabel="Hepsini seç"
      selectAllTitle={state =>
        state === 'mixed'
          ? 'Kısmi seçim — tümünü seçmek için tıkla'
          : state
            ? 'Tüm satırlar taslakta — kaldırmak için tıkla'
            : 'Tümünü taslağa ekle'
      }
      // Taslakta olmayan satırlar çıktı (sipariş listesi) dışında kalır.
      rowState={line => ({
        className: cn('print:bg-transparent', !(line.variantId in basket) && 'print:hidden'),
      })}
      cellClassName="print:border-neutral-400"
    />
  );
}
