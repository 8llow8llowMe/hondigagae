import { Skeleton } from '@/components/skeleton'
import { SurfaceList } from '@/components/surface'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 홈 "맞는 곳" 목록의 대기 골격 — 적합도 조회가 하나도 끝나지 않았을 때.
 *
 * **두 곳이 쓴다** (#907). `HomeView` 가 적합도를 기다리는 동안, 그리고 홈 `loading.tsx`
 * 가 서버 응답을 기다리는 동안이다. 폴백이 풀린 직후에도 적합도는 아직 클라이언트에서
 * 대기 중이라 곧바로 이 골격이 다시 선다 — 한 벌이어야 그 순간 행 수·열 수가 갈리지 않는다.
 *
 * 한 열에 두 행이다. 실제 목록도 한 열이고, 두 행이면 접힘 위에서 목록이라는 것이 읽힌다.
 */
export function SuitabilityListSkeleton() {
  return (
    <SurfaceList>
      {Array.from({ length: 2 }, (_, index) => (
        <li key={index} className={cn('flex gap-3 py-3', INSET_CLASS.card)}>
          <Skeleton variant="thumbnail" className="size-20 shrink-0 md:size-24" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
        </li>
      ))}
    </SurfaceList>
  )
}
