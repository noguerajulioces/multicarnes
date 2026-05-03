import { Skeleton } from './Skeleton'

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

export function TableSkeleton({ rows = 6, columns = 4, showHeader = true }: TableSkeletonProps) {
  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex gap-3 px-3 py-2 border-b border-border">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-3 flex-1 max-w-[80px]" />
          ))}
        </div>
      )}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 px-3 py-3">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
