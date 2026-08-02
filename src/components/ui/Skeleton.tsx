import { cn } from "@/lib/format";

type SkeletonVariant = "rect" | "circle" | "text";

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

export function Skeleton({ variant = "rect", className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-white/10 motion-reduce:animate-none",
        variant === "circle" && "rounded-full",
        variant === "text" && "rounded h-4",
        variant === "rect" && "rounded-lg",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-56 sm:w-64 p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg shadow-black/10 select-none">
      <div className="relative w-full aspect-square mb-2 rounded-xl overflow-hidden">
        <Skeleton variant="rect" className="w-full h-full" />
        <Skeleton variant="rect" className="absolute top-2 left-2 w-14 h-5 rounded-full" />
      </div>

      <div className="px-1 space-y-2">
        <Skeleton variant="text" className="w-full" />
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2 h-3" />
        <div className="flex items-baseline justify-between mb-3">
          <Skeleton variant="text" className="w-20 h-5" />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rect" className="flex-1 h-9 rounded-lg" />
          <Skeleton variant="rect" className="w-10 h-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
