import type { ReactNode } from 'react';
import { Package, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  /** Mesajın altında ikincil açıklama satırı. */
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

/** Kanonik tablo boş durumu: ikon + mesaj + opsiyonel temizleme aksiyonu. */
export function EmptyState({ message, description, actionLabel, onAction, icon: Icon = Package }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Icon className="h-8 w-8 text-hairline" />
      <div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-sm font-medium text-accent-blue underline-offset-4 hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
