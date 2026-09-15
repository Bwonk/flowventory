'use client';

import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrackSlider, useTrackOverflow } from './track-overflow';

interface ToolTrackProps {
  children: ReactNode;
  'aria-label'?: string;
  /** 'toolbar' aksiyon kümesi; 'group' filtre gibi durum seçicileri. */
  role?: 'toolbar' | 'group';
  className?: string;
}

/**
 * Araç yolu (DESIGN.md §5): birbirine bağlı aksiyonlar tek `bg-muted` parçada
 * yaşar — 36px yol, 3px iç boşluk, 30px segmentler (`Button size="segment"`,
 * `Dropdown variant="segment"`). Segment dili: ghost → `variant="segment"`,
 * öne çıkan/aktif → `segment-card`, birincil → `variant="default"` (ink hap).
 * Ayraç için `ToolTrackDivider`. Sığmayan yol kendi içinde kayar
 * (`useTrackOverflow`: kaydırıcı, tekerlek, kenar solması). Tab niteliğindeki
 * seçimler için `SegmentedTrack` (kayan hap) kullanılır.
 */
export function ToolTrack({ children, className, role = 'toolbar', 'aria-label': ariaLabel }: ToolTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { overflow, maskStyle, sliderProps } = useTrackOverflow(trackRef);

  return (
    <div className={cn('group/track relative min-w-0', className)}>
      <div
        ref={trackRef}
        role={role}
        aria-label={ariaLabel}
        style={maskStyle}
        className="flex h-9 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <TrackSlider overflow={overflow} sliderProps={sliderProps} />
    </div>
  );
}

/** Yol içi ince dikey ayraç — ghost segmentlerle ink birincil arasında. */
export function ToolTrackDivider() {
  return <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-hairline" />;
}
