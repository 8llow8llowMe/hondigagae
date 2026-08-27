import { Skeleton } from '@/components/skeleton'

/** 실제 콘텐츠와 크기를 맞춰 레이아웃 점프를 막는다 (coding-conventions.md §6) */
export function PlaceDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="card" className="aspect-video h-auto w-full" />

      <div className="flex flex-col gap-2">
        <Skeleton variant="text" className="h-5 w-32" />
        <Skeleton variant="text" className="h-9 w-3/4" />
      </div>

      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton variant="text" className="h-6 w-28" />
          <Skeleton variant="card" className="h-24" />
        </div>
      ))}
    </div>
  )
}
