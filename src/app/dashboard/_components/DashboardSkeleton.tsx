import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 w-full">
      {/* Hero */}
      <Skeleton className="h-[120px] w-full rounded-2xl bg-[#f3f4f6]" />
      
      {/* KPI */}
      <Skeleton className="h-[140px] w-full rounded-2xl bg-[#f3f4f6]" />
      
      {/* Stok Sağlığı */}
      <Skeleton className="h-[100px] w-full rounded-2xl bg-[#f3f4f6]" />
      
      {/* Chart */}
      <Skeleton className="h-[320px] w-full rounded-2xl bg-[#f3f4f6]" />
      
      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[400px] w-full rounded-2xl bg-[#f3f4f6]" />
        <Skeleton className="h-[400px] w-full rounded-2xl bg-[#f3f4f6]" />
      </div>
    </div>
  );
}
