'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, History, X } from 'lucide-react';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/api-error';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import { ACTION_CATALOG } from '@/lib/rules/actions-catalog';
import type { RuleEventItem } from '@/lib/rules/serialize';
import type { RuleActionResult } from '@/lib/rules/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { relativeTime } from '../RulesList';

interface RuleHistorySheetProps {
  token: string;
  ruleId: string;
  events: RuleEventItem[];
  /** Çok aşamalı kuralda satırda aşama no gösterilir. */
  multiStage: boolean;
}

/**
 * Oluşturucu başlığındaki "Geçmiş": son tetikler, her aksiyonun sonucu
 * (✓/✕ + detay) ve başarılı stok yazımında "Geri al".
 */
export function RuleHistorySheet({ token, ruleId, events: initialEvents, multiStage }: RuleHistorySheetProps) {
  const [events, setEvents] = useState(initialEvents);
  const [undoing, setUndoing] = useState<string | null>(null);

  const undo = async (eventId: string) => {
    setUndoing(eventId);
    try {
      const res = await ApiRequests.rules.undoStock(token, ruleId, eventId);
      const data = res.data?.data;
      if (!data) throw new Error('empty undo response');
      setEvents(prev => prev.map(e => (e.id === eventId ? data.event : e)));
      toast.success(`Stok geri alındı: ${data.previousCount} → ${data.newCount}`);
    } catch (error) {
      logger.error('Rule stock undo failed', { ruleId, eventId, error });
      toast.error(extractErrorMessage(error, 'Stok geri alınamadı.'));
    } finally {
      setUndoing(null);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <History className="size-3.5" aria-hidden />
          Geçmiş
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-hairline py-3">
          <SheetTitle className="text-sm font-medium text-foreground">Tetik geçmişi</SheetTitle>
          <SheetDescription className="sr-only">Kuralın son tetiklenmeleri ve aksiyon sonuçları.</SheetDescription>
        </SheetHeader>

        {events.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">Henüz tetiklenmedi.</p>
        ) : (
          <ul className="flex-1 divide-y divide-hairline overflow-y-auto px-4">
            {events.map(e => (
              <li key={e.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/dashboard/stok?product=${e.productId}`}
                    className="min-w-0 truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {e.productName}
                  </Link>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {multiStage && `Aşama ${e.stageIndex + 1} · `}
                    {relativeTime(e.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-pretty text-xs text-muted-foreground">{e.body}</p>
                {e.actions.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {e.actions.map((a, i) => (
                      <ActionResultRow key={i} result={a} undoing={undoing === e.id} onUndo={() => undo(e.id)} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActionResultRow({ result, undoing, onUndo }: { result: RuleActionResult; undoing: boolean; onUndo: () => void }) {
  const Icon = result.ok ? Check : X;
  return (
    <li className="flex items-center gap-2 text-xs">
      <Icon className={result.ok ? 'size-3.5 shrink-0 text-foreground' : 'size-3.5 shrink-0 text-destructive'} aria-label={result.ok ? 'Başarılı' : 'Başarısız'} />
      <span className="shrink-0 text-foreground">{ACTION_CATALOG[result.type].label}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={result.detail}>
        {result.detail}
      </span>
      {result.stock &&
        (result.stock.undoneAt ? (
          <span className="shrink-0 text-muted-foreground">Geri alındı</span>
        ) : (
          <Button variant="outline" size="xs" className="shrink-0" onClick={onUndo} disabled={undoing}>
            {undoing ? 'Alınıyor…' : 'Geri al'}
          </Button>
        ))}
    </li>
  );
}
