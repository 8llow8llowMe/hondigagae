import { Card } from '@/components/card'
import { Skeleton } from '@/components/skeleton'

/**
 * 실제 카드와 **같은 구조**로 그린다.
 *
 * 고정 높이(예: `h-28`)를 쓰면 실데이터 카드가 114~162px 로 흩어져 레이아웃 점프가 생긴다
 * (실측으로 확인). 썸네일·배지·제목·주소를 같은 골격으로 두면 자연히 비슷한 높이가 된다.
 * — docs/styling-guide.md §2
 */
export function PlaceCardSkeleton() {
  return (
    <Card>
      <div className="flex gap-4 p-4 md:gap-5 md:p-5">
        <Skeleton variant="thumbnail" className="h-20 w-20 shrink-0 md:h-24 md:w-24" />

        <div className="min-w-0 flex-1">
          <div className="flex gap-1">
            <Skeleton className="h-5 w-16 rounded-sm" />
            <Skeleton className="h-5 w-20 rounded-sm" />
          </div>
          <Skeleton className="mt-2 h-6 w-full" />
          <Skeleton className="mt-1 h-6 w-2/3" />
          <Skeleton className="mt-1 h-5 w-4/5" />
        </div>
      </div>
    </Card>
  )
}
