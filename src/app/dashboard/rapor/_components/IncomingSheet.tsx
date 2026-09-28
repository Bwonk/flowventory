'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { toast } from 'sonner';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/shared/NumberStepper';
import { SkeletonRows } from '@/components/shared/data-table/SkeletonRows';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { extractErrorMessage } from '@/lib/api-error';
import { ApiRequests } from '@/lib/api-requests';
import { formatPrice } from '@/lib/currency';
import { logger } from '@/lib/logger';
import { EASE_OUT, INSTANT } from '@/lib/motion';
import { isLate, remainingQty, type PurchaseOrderItem } from '@/lib/purchase-orders/types';

const COLLAPSE: Transition = { opacity: { duration: 0.12 }, height: { duration: 0.2, ease: EASE_OUT, delay: 0.04 } };
const ENTER: Transition = { opacity: { duration: 0.15 }, height: { duration: 0 } };
/** "Kalanı iptal et" ikinci tıklamayı bu kadar bekler. */
const CONFIRM_MS = 3000;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

function statusBadge(order: PurchaseOrderItem): { label: string; variant: BadgeVariant } {
  if (isLate(order)) return { label: 'Gecikti', variant: 'warning' };
  if (order.status === 'partial') return { label: 'Kısmi', variant: 'info' };
  return { label: 'Gönderildi', variant: 'neutral' };
}

interface IncomingSheetProps {
  token: string | null;
  /** Teslim alma / iptal / geri al sonrası: rapor stok ve yoldaki adetleri tazeler. */
  onChanged: () => void;
  /** Dış tetikleyici (ExpandableActionBar öğesi). */
  trigger: ReactNode;
}

/**
 * Yolda çekmecesi — gönderilmiş, henüz tamamen gelmemiş siparişler. Taslaklar
 * çekmecesiyle aynı soft grup dili (bg-muted blok, beyaz satır listesi).
 * "Teslim al ve stoğa yaz" gelen adetleri ikas'a yazar; toast'taki "Geri al"
 * teslimi geri çevirir. Stok yalnız buradan yazılır (satırda stok butonu yok).
 */
export function IncomingSheet({ token, onChanged, trigger }: IncomingSheetProps) {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrderItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await ApiRequests.purchaseOrders.listOpen(token);
      setOrders(res.data?.data?.orders ?? []);
    } catch (err) {
      logger.error('Open orders fetch failed', { error: err });
      setError('Siparişler yüklenemedi.');
    }
  }, [token]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const replaceOrder = useCallback((next: PurchaseOrderItem) => {
    setOrders(prev => {
      if (!prev) return prev;
      const stillOpen = next.status === 'sent' || next.status === 'partial';
      if (!prev.some(o => o.id === next.id)) return stillOpen ? [next, ...prev] : prev;
      return stillOpen ? prev.map(o => (o.id === next.id ? next : o)) : prev.filter(o => o.id !== next.id);
    });
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-hairline py-3">
          <SheetTitle className="text-sm font-medium text-foreground">Yolda</SheetTitle>
          <SheetDescription className="sr-only">
            Gönderilmiş siparişler. Gelen adetleri girip stoğa yazın.
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Tekrar dene
            </Button>
          </div>
        ) : orders === null ? (
          <div className="px-3 pt-3">
            <SkeletonRows rows={3} variant="compact" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-foreground">Yolda sipariş yok</p>
            <p className="text-xs text-muted-foreground">
              Taslaktan gönderdiğiniz siparişler teslim alınana kadar burada durur.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 pt-3">
            <AnimatePresence initial={false}>
              {orders.map(order => (
                <OrderGroup
                  key={order.id}
                  token={token}
                  order={order}
                  onOrderChange={next => {
                    replaceOrder(next);
                    onChanged();
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrderGroup({
  token,
  order,
  onOrderChange,
}: {
  token: string | null;
  order: PurchaseOrderItem;
  onOrderChange: (order: PurchaseOrderItem) => void;
}) {
  const reduceMotion = useReducedMotion();
  const presence = {
    initial: { opacity: 0, height: 'auto' },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0, transition: reduceMotion ? INSTANT : COLLAPSE },
    transition: reduceMotion ? INSTANT : ENTER,
  } as const;

  // "Bu teslimat" varsayılanı kalan adet: tam teslimde tek tık yeter.
  const initialCounts = useCallback(
    () => Object.fromEntries(order.lines.map(l => [l.variantId, remainingQty(l)])),
    [order.lines],
  );
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  useEffect(() => setCounts(initialCounts()), [initialCounts]);
  const [busy, setBusy] = useState<'receive' | 'cancel' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => {
    if (!confirmCancel) return;
    const t = setTimeout(() => setConfirmCancel(false), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirmCancel]);

  const receiveTotal = Object.values(counts).reduce((s, n) => s + n, 0);
  const remainingTotal = order.lines.reduce((s, l) => s + remainingQty(l), 0);
  const badge = statusBadge(order);

  const undo = async (receiptId: string) => {
    if (!token) return;
    try {
      const res = await ApiRequests.purchaseOrders.undoReceipt(token, order.id, receiptId);
      const next = res.data?.data?.order;
      if (next) onOrderChange(next);
      toast.success('Teslim geri alındı');
    } catch (error) {
      logger.error('Receipt undo failed', { orderId: order.id, error });
      toast.error(extractErrorMessage(error, 'Teslim geri alınamadı.'));
    }
  };

  const receive = async () => {
    if (!token || receiveTotal === 0) return;
    setBusy('receive');
    try {
      const lines = Object.entries(counts)
        .filter(([, qty]) => qty > 0)
        .map(([variantId, qty]) => ({ variantId, qty }));
      const res = await ApiRequests.purchaseOrders.receive(token, order.id, lines);
      const data = res.data?.data;
      if (!data) throw new Error('Empty receive response');
      onOrderChange(data.order);
      toast.success(`${order.label}: ${receiveTotal.toLocaleString('tr-TR')} adet stoğa yazıldı`, {
        action: { label: 'Geri al', onClick: () => void undo(data.receiptId) },
        duration: 8000,
      });
    } catch (error) {
      logger.error('Order receive failed', { orderId: order.id, error });
      toast.error(extractErrorMessage(error, 'Teslim alınamadı.'));
    } finally {
      setBusy(null);
    }
  };

  const cancelRemaining = async () => {
    if (!token) return;
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setConfirmCancel(false);
    setBusy('cancel');
    try {
      const res = await ApiRequests.purchaseOrders.cancelRemaining(token, order.id);
      const next = res.data?.data?.order;
      if (next) onOrderChange(next);
      toast.success(`${order.label} kapatıldı`);
    } catch (error) {
      logger.error('Cancel remaining failed', { orderId: order.id, error });
      toast.error(extractErrorMessage(error, 'Sipariş kapatılamadı.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div {...presence} className="overflow-hidden">
      <section aria-label={`${order.vendorName} ${order.label ?? ''}`} className="mb-3 rounded-lg bg-muted">
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {order.vendorName} · <span className="font-mono text-xs">{order.label}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {order.sentAt && `Gönderildi ${shortDate(order.sentAt)}`}
              {order.expectedAt && ` · beklenen ${shortDate(order.expectedAt)}`}
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <ul className="mx-2 mb-2 divide-y divide-border rounded-md bg-card">
          {order.lines.map(line => {
            const remaining = remainingQty(line);
            return (
              <li key={line.variantId} className="flex items-center gap-2.5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{line.productName}</p>
                  <p className="truncate text-xs tabular-nums text-muted-foreground">
                    {[line.variantName, `${line.receivedQty} / ${line.qty} geldi`].filter(Boolean).join(' · ')}
                    {line.cancelledQty > 0 && ` · ${line.cancelledQty} iptal`}
                  </p>
                </div>
                {remaining === 0 ? (
                  <Badge variant="success">Tamam</Badge>
                ) : (
                  <NumberStepper
                    value={counts[line.variantId] ?? 0}
                    min={0}
                    max={remaining}
                    onChange={next => setCounts(prev => ({ ...prev, [line.variantId]: next }))}
                    label={`${line.productName} bu teslimatta gelen adet`}
                    disabled={busy !== null}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <Button
            variant={confirmCancel ? 'destructive' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => void cancelRemaining()}
            disabled={busy !== null}
          >
            {confirmCancel ? `Kalan ${remainingTotal} adet iptal edilsin mi?` : 'Kalanı iptal et'}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => void receive()} disabled={busy !== null || receiveTotal === 0}>
            {busy === 'receive'
              ? 'Yazılıyor…'
              : receiveTotal === 0
                ? 'Gelen adet girin'
                : `${receiveTotal.toLocaleString('tr-TR')} adedi teslim al`}
          </Button>
        </div>
        {order.totalCost > 0 && (
          <p className="px-3 pb-2.5 text-[11px] tabular-nums text-muted-foreground">
            Sipariş tutarı {formatPrice(order.totalCost)}
            {order.hasUnknownCost && ' (fiyatı bilinen satırlar)'}
          </p>
        )}
      </section>
    </motion.div>
  );
}
