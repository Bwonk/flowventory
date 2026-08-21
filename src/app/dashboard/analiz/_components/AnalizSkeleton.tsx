import { PageContainer } from '@/components/layout/PageContainer';
import { Skeleton } from '@/components/ui/skeleton';

export function AnalizSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-8 h-10 w-56" />
      <Skeleton className="mb-4 h-32 rounded-lg" />
      <Skeleton className="mb-4 h-40 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
    </PageContainer>
  );
}
