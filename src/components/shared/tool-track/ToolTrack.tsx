import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ToolTrackProps {
  children: ReactNode;
  'aria-label'?: string;
  className?: string;
}

/**
 * Araç yolu (DESIGN.md §5): birbirine bağlı aksiyonlar tek `bg-muted` parçada
 * yaşar — 36px yol, 3px iç boşluk, 30px segmentler (`Button size="segment"`).
 * Segment dili: ghost → `variant="segment"`, ikincil öne çıkan → `segment-card`,
 * birincil → `variant="default"` (ink hap). Ayraç için `ToolTrackDivider`.
 * Tab niteliğindeki seçimler için `SegmentedTrack` (kayan hap) kullanılır.
 */
export function ToolTrack({ children, className, 'aria-label': ariaLabel }: ToolTrackProps) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn('flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-muted p-[3px]', className)}
    >
      {children}
    </div>
  );
}

/** Yol içi ince dikey ayraç — ghost segmentlerle ink birincil arasında. */
export function ToolTrackDivider() {
  return <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-hairline" />;
}
