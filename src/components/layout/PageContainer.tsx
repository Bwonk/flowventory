import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tek container standardı (DESIGN.md §4): tüm dashboard sayfaları içeriklerini
 * bununla sarar; başka container genişliği tanımlanmaz.
 */
export function PageContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-6 py-6', className)}>{children}</div>;
}
