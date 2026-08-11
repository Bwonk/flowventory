'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';

/**
 * Dashboard segmenti için Next.js error boundary.
 * Render sırasında fırlayan hataları yakalar; iframe boş kalmaz.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard render error:', error);
  }, [error]);

  return (
    <ErrorState
      title="Bir şeyler ters gitti"
      description="Sayfa görüntülenirken beklenmeyen bir hata oluştu."
      onRetry={reset}
    />
  );
}
