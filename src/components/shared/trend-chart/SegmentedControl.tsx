'use client';

import { SegmentedTrack } from '@/components/shared/tool-track';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Metrik/pencere seçici — `SegmentedTrack`'in kompakt (32px) hali; hap
 * segmentler arasında kayar (DESIGN.md §5 "Araç yolu").
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <SegmentedTrack
      options={options}
      value={value}
      onChange={onChange}
      size="sm"
      aria-label={ariaLabel}
      className={className}
    />
  );
}
