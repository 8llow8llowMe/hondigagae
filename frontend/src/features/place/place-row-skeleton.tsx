import { Skeleton } from '@/components/skeleton'
import { Row } from '@/components/surface'

/**
 * 실제 행과 **같은 골격**으로 그린다 — 썸네일 자리를 포함해 높이·리듬을 흉내 낸다
 * (가이드 §6 loading).
 *
 * 고정 높이(예: `h-28`)를 쓰면 실데이터 행과 어긋나 레이아웃 점프가 생긴다.
 * 같은 골격을 두면 자연히 비슷한 높이가 된다.
 */
export function PlaceRowSkeleton({ last = false }: { last?: boolean }) {
  return (
    <Row as="li" last={last}>
      <div className="flex gap-4 py-4">
        <Skeleton variant="thumbnail" className="h-20 w-20 shrink-0 md:h-24 md:w-24" />

        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="mt-1 h-6 w-2/3" />
          <Skeleton className="mt-1 h-5 w-4/5" />
          <div className="mt-2 flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-sm" />
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
        </div>
      </div>
    </Row>
  )
}
