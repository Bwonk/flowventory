import { Skeleton } from "@/components/ui/skeleton";

export function AyarlarSkeleton() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 w-full">
      {/* Title */}
      <div>
        <Skeleton className="h-3 w-20 mb-2 bg-[#f3f4f6]" />
        <Skeleton className="h-8 w-40 bg-[#f3f4f6]" />
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24 bg-[#f3f4f6]" />
            <Skeleton className="h-10 w-full rounded-lg bg-[#f3f4f6]" />
          </div>
        ))}
      </div>

      {/* Button */}
      <Skeleton className="h-10 w-32 rounded-lg bg-[#f3f4f6]" />
    </div>
  );
}
