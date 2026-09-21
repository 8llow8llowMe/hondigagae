import { Skeleton } from '@/components/skeleton'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/** 첫 조회 스켈레톤 행 수 — `코스목록-세부명세.md` D5 */
export const WALK_COURSE_SKELETON_COUNT = 6

/**
 * 실제 행과 **같은 골격**으로 그린다 (가이드 §6 loading).
 *
 * **바깥 상자 클래스를 `WalkCourseRow` 와 글자 그대로 맞춘다** (#800). 1024 부터 실제
 * 행은 `.walk-course-row-grid` 6칸 표인데 스켈레톤만 3줄 세로 블록이라, 6행이면
 * 로딩→결과 전환에서 **약 168px 이 위로 당겨졌다**. 높이를 따로 계산해 맞추지 않고
 * 같은 클래스를 쓰는 이유는, 한쪽만 고쳐지는 일을 막기 위해서다 — `lg:min-h-18`(72px)·
 * `lg:py-4`·`lg:gap-5` 중 하나라도 행에서 바뀌면 여기도 같이 봐야 한다.
 *
 * **썸네일 자리를 만들지 않는다.** 실데이터 29개 중 25개에 이미지가 없어(공통명세 S3-1)
 * 썸네일이 있는 스켈레톤을 쓰면 **대다수의 행이 응답과 함께 좌로 밀린다** — 로딩과 결과가
 * 다른 골격이면 레이아웃이 점프한다. `PlaceRowSkeleton` 과 갈리는 자리이고, 이유는
 * `WalkCourseRow` 가 타일을 안 두는 이유와 같다.
 *
 * 이 판단이 걸리는 곳은 **1024 미만뿐**이다. 1024 이상에서는 트랙(`2.5rem`)이 5번 칸을
 * 언제나 잡고 있어 썸네일 유무로 가로가 밀리지 않는다. 좌표·이미지가 29/29 로 늘면
 * (#767 · BE #722) 1024 미만 판단만 다시 보면 된다.
 *
 * **chevron 자리에는 뼈대를 두지 않는다.** 데이터가 아니라 "누를 수 있다" 는 고정
 * 장치라 로딩 중에 흉내 낼 것이 없다. 6번 트랙(`1.25rem`)이 자리를 이미 잡고 있어
 * 비워 두어도 가로가 밀리지 않는다.
 */
export function WalkCourseRowSkeleton({ inset = 'card' }: { inset?: Inset }) {
  return (
    <li className={INSET_CLASS[inset]}>
      <div
        className={cn(
          'flex min-h-11 items-center gap-3 py-3 md:py-4',
          'walk-course-row-grid lg:grid lg:min-h-18 lg:items-center lg:gap-5 lg:py-4',
        )}
      >
        {/* 코스 열 — 1024 미만에서는 아래 두 줄을 품고, 1024 이상에서는 이름만 남는다 */}
        <div className="min-w-0 flex-1 lg:col-start-1 lg:flex-none">
          <Skeleton className="h-6 w-2/3" />
          {/* 거리·소요시간 합친 줄 / 시종점 줄 — 1024 이상은 각자 열로 나가므로 감춘다 */}
          <Skeleton className="mt-1 h-5 w-32 lg:hidden" />
          <Skeleton className="mt-1 h-4 w-1/2 lg:hidden" />
        </div>

        {/* 거리 열 — 실제 값이 오른쪽 정렬이라 뼈대도 오른쪽에 붙인다 */}
        <Skeleton className="hidden h-5 w-12 justify-self-end lg:col-start-2 lg:block" />

        {/* 소요시간 열 */}
        <Skeleton className="hidden h-5 w-16 justify-self-end lg:col-start-3 lg:block" />

        {/* 시종점 열 — 실제로는 truncate 한 줄이라 폭을 칸에 맞춰 늘린다 */}
        <Skeleton className="hidden h-4 w-3/4 lg:col-start-4 lg:block" />
      </div>
    </li>
  )
}
