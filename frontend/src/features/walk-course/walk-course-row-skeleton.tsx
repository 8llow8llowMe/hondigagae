import { Skeleton } from '@/components/skeleton'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'

/** 첫 조회 스켈레톤 행 수 — `코스목록-세부명세.md` D5 */
export const WALK_COURSE_SKELETON_COUNT = 6

/**
 * 실제 행과 **같은 골격**으로 그린다 (가이드 §6 loading).
 *
 * **썸네일 자리를 만들지 않는다.** 실데이터 29개 중 25개에 이미지가 없어(공통명세 S3-1)
 * 썸네일이 있는 스켈레톤을 쓰면 **대다수의 행이 응답과 함께 좌로 밀린다** — 로딩과 결과가
 * 다른 골격이면 레이아웃이 점프한다. `PlaceRowSkeleton` 과 갈리는 자리이고, 이유는
 * `WalkCourseRow` 가 타일을 안 두는 이유와 같다.
 */
export function WalkCourseRowSkeleton({ inset = 'card' }: { inset?: Inset }) {
  return (
    <li className={INSET_CLASS[inset]}>
      <div className="py-3 md:py-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-1 h-5 w-32" />
        <Skeleton className="mt-1 h-4 w-1/2" />
      </div>
    </li>
  )
}
