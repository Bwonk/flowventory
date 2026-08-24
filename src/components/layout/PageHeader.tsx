import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Mono, uppercase mikro-etiket — başlığın üstünde. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Sağa yaslanan aksiyon alanı (butonlar vb.). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Sayfa başlığı deseni (DESIGN.md §3): eyebrow + h1 + açıklama + actions.
 * Her dashboard sayfası bununla açılır.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
