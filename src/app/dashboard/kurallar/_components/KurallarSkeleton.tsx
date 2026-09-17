import { PageContainer } from '@/components/layout/PageContainer';
import { Skeleton } from '@/components/ui/skeleton';

export function KurallarSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="mb-8 h-10 w-40" />
      <Skeleton className="h-72 rounded-lg" />
    </PageContainer>
  );
}
