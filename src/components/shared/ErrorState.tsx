'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';

/**
 * Veri çekilemediğinde gösterilen hata paneli.
 *
 * Daha önce fetch hataları yalnızca console'a yazılıyor, kullanıcı boş bir
 * dashboard görüyordu ("verim yok" sanıyordu). Bu component hatayı görünür
 * yapar ve yeniden deneme imkânı verir.
 */
export function ErrorState({
  title = 'Veriler yüklenemedi',
  description = 'Sunucuya ulaşılamadı veya beklenmeyen bir hata oluştu.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-hairline bg-card px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Tekrar dene
          </button>
        )}
      </div>
    </PageContainer>
  );
}
