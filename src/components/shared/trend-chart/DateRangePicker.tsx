'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface QuickRangeOption<T extends string> {
  value: T;
  label: string;
}

interface DateRangePickerProps<T extends string> {
  quickRanges: ReadonlyArray<QuickRangeOption<T>>;
  /** Aktif hızlı aralık ('custom' ise appliedRange geçerlidir). */
  period: T | 'custom';
  appliedRange?: DateRange;
  triggerLabel: string;
  showCustom: boolean;
  portalContainer?: HTMLElement | null;
  onSelectQuick: (value: T) => void;
  onApplyCustom: (range: DateRange) => void;
}

/**
 * Trend grafiği tarih aralığı seçici: hızlı aralık segmentleri + özel aralık
 * takvimi. Taslak durum (draft) yalnızca popover içinde yaşar; Uygula ile
 * üst bileşene taşınır.
 */
export function DateRangePicker<T extends string>({
  quickRanges,
  period,
  appliedRange,
  triggerLabel,
  showCustom,
  portalContainer,
  onSelectQuick,
  onApplyCustom,
}: DateRangePickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  // Masaüstünde iki ay, dar düzenlerde tek ay göster.
  const [monthsToShow, setMonthsToShow] = useState(2);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftFade(scrollLeft > 0);
      // yuvarlama hataları için 1px tolerans
      setShowRightFade(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // DOM boyanmadan ölçüm yapmamak için mikro-gecikme
      setTimeout(() => {
        if (scrollRef.current) {
          const activeBtn = scrollRef.current.querySelector('[aria-selected="true"]') as HTMLButtonElement | null;
          if (activeBtn) {
            const container = scrollRef.current;
            const btnLeft = activeBtn.offsetLeft - container.offsetLeft;
            const btnRight = btnLeft + activeBtn.offsetWidth;
            if (btnLeft < container.scrollLeft) {
              container.scrollLeft = btnLeft - 8;
            } else if (btnRight > container.scrollLeft + container.clientWidth) {
              container.scrollLeft = btnRight - container.clientWidth + 8;
            }
          }
        }
        handleScroll();
      }, 0);
    }
  }, [open, handleScroll, period]);

  useEffect(() => {
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setMonthsToShow(mq.matches ? 2 : 1);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Popover açıldığında taslağı uygulanan aralıkla senkronla.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setDraftRange(appliedRange);
      setOpen(next);
    },
    [appliedRange],
  );

  const selectQuickRange = useCallback(
    (value: T) => {
      setDraftRange(undefined);
      setOpen(false);
      onSelectQuick(value);
    },
    [onSelectQuick],
  );

  const canApplyCustom = Boolean(draftRange?.from && draftRange?.to);

  const applyCustomRange = useCallback(() => {
    if (!draftRange?.from || !draftRange?.to) return;
    setOpen(false);
    onApplyCustom(draftRange);
  }, [draftRange, onApplyCustom]);

  const draftFromLabel = draftRange?.from ? format(draftRange.from, 'd MMM yyyy', { locale: tr }) : null;
  const draftToLabel = draftRange?.to ? format(draftRange.to, 'd MMM yyyy', { locale: tr }) : null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Tarih aralığı seç"
          aria-expanded={open}
          className={cn(
            'h-9 gap-1.5 rounded-md px-3 text-xs font-normal text-foreground',
            period === 'custom' && 'border-foreground bg-muted',
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span>{triggerLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer ?? undefined}
        align="end"
        sideOffset={6}
        className="z-[100] w-auto max-w-[calc(100vw-1rem)] rounded-lg p-4"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        {/* Hızlı aralıklar */}
        <div className="relative">
          <div
            className={cn(
              'pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-6 bg-gradient-to-r from-popover to-transparent transition-opacity duration-200',
              showLeftFade ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div
            className={cn(
              'pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-6 bg-gradient-to-l from-popover to-transparent transition-opacity duration-200',
              showRightFade ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-0.5 overflow-x-auto scroll-smooth rounded-lg bg-muted p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            role="listbox"
            aria-label="Hızlı aralıklar"
          >
            {quickRanges.map(r => {
              const active = period === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => selectQuickRange(r.value)}
                  className={cn(
                    'flex h-8 shrink-0 items-center justify-center rounded-md px-4 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {showCustom && (
          <>
            <div className="-mx-4 my-4 border-t border-hairline" />

            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">ÖZEL ARALIK</p>
            <div className="mb-2" aria-live="polite">
              {!draftFromLabel ? (
                <p className="text-xs text-muted-foreground">Tarih aralığı seçin</p>
              ) : !draftToLabel ? (
                <div className="flex gap-1 text-xs">
                  <span className="text-foreground">Başlangıç: {draftFromLabel}</span>
                  <span className="text-border">|</span>
                  <span className="text-muted-foreground">Bitiş tarihini seçin</span>
                </div>
              ) : (
                <p className="text-xs font-medium text-foreground">
                  {draftFromLabel} – {draftToLabel}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={draftRange}
                onSelect={nextRange => setDraftRange(nextRange)}
                defaultMonth={draftRange?.from ?? appliedRange?.from}
                numberOfMonths={monthsToShow}
                showOutsideDays
                locale={tr}
                className="p-0"
                classNames={{
                  weekday: 'flex-1 rounded-md text-[0.8rem] font-medium text-muted-foreground select-none',
                  month: 'flex w-full flex-col gap-3',
                }}
              />
            </div>
            <div className="-mx-4 mt-3 flex items-center justify-end gap-2 border-t border-hairline px-4 pt-3">
              <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} className="h-8 rounded-md text-xs">
                İptal
              </Button>
              <Button size="sm" onClick={applyCustomRange} disabled={!canApplyCustom} className="h-8 rounded-md text-xs">
                Uygula
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
