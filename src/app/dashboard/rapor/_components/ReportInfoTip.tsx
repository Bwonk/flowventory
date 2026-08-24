'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';
import { InformationCircleIcon } from '@/components/ui/icons/information-circle';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';

interface ReportInfoTipProps {
  /** Balonda gösterilen metin — satış penceresi + üretim zamanı. */
  text: string;
}

/**
 * Başlık yanındaki "i": raporun hangi pencereye göre ve ne zaman üretildiği
 * balonda okunur. Balon sidebar'ın kapalı-hal tooltip'iyle aynı primitif
 * (animate-ui Tooltip — ink zemin, oklu, sağda); ikon animasyonu butondan
 * sürülür (DESIGN.md §6). Sağlayıcı SidebarProvider'dan gelir.
 */
export function ReportInfoTip({ text }: ReportInfoTipProps) {
  const { ref, hoverProps } = useIconHover();

  return (
    <Tooltip side="right" align="center">
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Rapor bilgisi: ${text}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...hoverProps}
        >
          <InformationCircleIcon ref={ref} size={16} className="flex" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
