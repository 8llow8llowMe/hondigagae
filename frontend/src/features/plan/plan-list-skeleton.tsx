import { Skeleton } from '@/components/skeleton'
import { SurfaceList } from '@/components/surface'
import { INSET_CLASS } from '@/lib/ui/inset'

/**
 * 목록 로딩 — 아트보드 06 ②.
 *
 * **썸네일 자리를 만들지 않는다.** 긴급 시설·장소 목록의 스켈레톤에는 80×80 자리가
 * 있지만 일정 행에는 이미지가 없다. 없는 자리를 흉내 내면 로딩이 끝나는 순간 행이
 * 좁아지며 목록이 들썩인다.
 *
 * 실제 행(`PlanRow`)과 같은 규약이다 — `SurfaceList` 안의 `li`, 카드 인셋 (#445).
 *
 * `Skeleton` 이 자체적으로 `aria-hidden` 이라 스크린리더는 이 목록을 읽지 않는다.
 */
export function PlanListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SurfaceList>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className={INSET_CLASS.card}>
          <div className="flex flex-col gap-2 py-4 lg:py-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
        </li>
      ))}
    </SurfaceList>
  )
}
