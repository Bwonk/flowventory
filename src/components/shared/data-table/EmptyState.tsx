import { Package, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

/** Kanonik tablo boş durumu: ikon + mesaj + opsiyonel temizleme aksiyonu. */
export function EmptyState({ message, actionLabel, onAction, icon: Icon = Package }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Icon className="h-8 w-8 text-hairline" />
      <p className="text-sm text-muted-foreground">{message}</p>
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
