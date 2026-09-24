import { Skeleton } from '@/components/skeleton'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { WalkCourseCardGrid } from '@/features/walk-course/walk-course-row'
import {
  WALK_COURSE_SKELETON_COUNT,
  WalkCourseRowSkeleton,
} from '@/features/walk-course/walk-course-row-skeleton'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 제주올레 코스 목록 최초 진입 로딩 (#907). 섹션 내부 재조회 로딩은
 * `WalkCourseListBody` 가 같은 `WalkCourseRowSkeleton` 으로 담당한다.
 *
 * **목록이 `(list)` 그룹으로 옮겨 왔다.** `olle/[walkCourseId]` 는 `notFound()` 를 부르지
 * 않아 soft 404 위험은 없지만, `olle/loading.tsx` 로 두면 **코스 상세로 가는 동안 목록
 * 골격이 선다** — 사진 그리드가 잠깐 떴다가 상세로 바뀌는 모양이다. 상세는 자기 골격이
 * 따로 있으므로(`WalkCourseDetailView`) 목록 골격은 목록에만 건다.
 *
 * **실화면과 같은 카드 하나다** (`WalkCourseListSection`). 제목·설명 줄은 고정 문자열이라
 * 그대로 쓴다 — 설명은 로딩 중에도 실제로 서는 줄이다(D6 "슬롯이 통째로 비면 골격
 * 화면에 제목만 남는다"). **결과 수 줄은 자리를 잡는다** — 응답이 있어야 숫자가 정해지지만
 * 조회가 끝나면 늘 서는 줄이라, 비워 두면 폴백이 풀릴 때 카드 그리드가 그만큼 밀린다
 * (390 실측). 활동량 근거 줄은 대표 반려견이 있을 때만 서므로 잡지 않는다.
 *
 * **도구 줄은 활동량·정렬 두 필드의 자리만 잡는다.** 둘 다 `loading.tsx` 가 받지 못하는
 * `searchParams` 로 선택값이 정해진다 (Next 규약). 라벨 한 줄 + 세그먼트 컨트롤 한 줄이
 * 실화면의 높이다.
 *
 * 카드 그리드는 실화면과 같은 `WalkCourseCardGrid` 다 — 같은 열 수·같은 간격이어야
 * 폴백이 풀릴 때 카드가 제자리에 선다.
 */
export default function WalkCoursesLoading() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.walkCourse.pageTitle}</h1>

        <Surface
          lead
          titleId="walk-course-list-heading"
          title={messages.walkCourse.pageTitle}
          description={
            <div className="flex flex-col gap-2">
              <p className="text-body-2 text-fg-muted break-keep">
                {messages.walkCourse.listDescription}
              </p>
              {/* 결과 수 줄 — 조회가 끝나면 늘 선다 */}
              <Skeleton className="h-5 w-20" />
            </div>
          }
          tools={
            <div
              aria-hidden
              className={cn('flex flex-col gap-4 md:flex-row md:gap-6', INSET_CLASS.card)}
            >
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
              ))}
            </div>
          }
          aria-busy
        >
          <WalkCourseCardGrid aria-busy>
            {Array.from({ length: WALK_COURSE_SKELETON_COUNT }, (_, index) => (
              <WalkCourseRowSkeleton key={index} />
            ))}
          </WalkCourseCardGrid>
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}
