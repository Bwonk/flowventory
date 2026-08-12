import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 w-full">
      {/* Hero */}
      <Skeleton className="h-[120px] w-full rounded-lg bg-muted" />
      
      {/* KPI */}
      <Skeleton className="h-[140px] w-full rounded-lg bg-muted" />
      
      {/* Stok Sağlığı */}
      <Skeleton className="h-[100px] w-full rounded-lg bg-muted" />
      
      {/* Chart */}
      <Skeleton className="h-[320px] w-full rounded-lg bg-muted" />
      
      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[400px] w-full rounded-lg bg-muted" />
        <Skeleton className="h-[400px] w-full rounded-lg bg-muted" />
      </div>
    </div>
  );
}
