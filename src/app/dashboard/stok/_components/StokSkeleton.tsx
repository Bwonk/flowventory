import { Skeleton } from "@/components/ui/skeleton";

export function StokSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <Skeleton className="h-3 w-24 mb-2 bg-[#f3f4f6]" />
          <Skeleton className="h-8 w-40 bg-[#f3f4f6]" />
        </div>
        <Skeleton className="h-9 w-28 rounded-full bg-[#f3f4f6]" />
      </div>

      {/* Filter Bar */}
      <Skeleton className="h-14 w-full rounded-xl mb-4 bg-[#f3f4f6]" />

      {/* Table */}
      <div className="w-full">
        {/* Table Header */}
        <Skeleton className="h-8 w-full mb-2 bg-[#f3f4f6]" />
        
        {/* 8 Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-[#f3f4f6]">
            <Skeleton className="size-10 rounded-lg shrink-0 bg-[#f3f4f6]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 bg-[#f3f4f6]" />
              <Skeleton className="h-3 w-24 bg-[#f3f4f6]" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full shrink-0 bg-[#f3f4f6]" />
            <Skeleton className="h-4 w-12 shrink-0 bg-[#f3f4f6]" />
            <Skeleton className="h-4 w-12 shrink-0 bg-[#f3f4f6]" />
            <Skeleton className="h-5 w-16 shrink-0 bg-[#f3f4f6]" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <Skeleton className="h-9 w-64 mx-auto mt-4 rounded-md bg-[#f3f4f6]" />
    </div>
  );
}
