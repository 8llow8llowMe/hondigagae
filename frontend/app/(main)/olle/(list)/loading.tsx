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
 * 화면에 제목만 남는다").
 *
 * **결과 수 줄은 필터 아래, 본문 첫 줄이다** (#944). 예전 골격은 이 줄을 설명 바로 아래
 * (필터 **위**)에 두어, 폴백이 풀리는 순간 개수가 필터 아래로 자리를 옮겼다 — #944 가
 * 실화면의 줄을 옮길 때 이 파일이 따라가지 않았다. 응답이 있어야 숫자가 정해지지만 조회가
 * 끝나면 늘 서는 줄이라 자리를 잡는다. 활동량 근거 줄은 대표 반려견이 있을 때만 서므로
 * 잡지 않는다.
 *
 * **도구 줄은 활동량·정렬 두 필드의 자리만 잡는다.** 둘 다 `loading.tsx` 가 받지 못하는
 * `searchParams` 로 선택값이 정해진다 (Next 규약). 배치는 실화면(`WalkCourseListView` ·
 * `FieldGroup`)과 같은 클래스다 — 모바일은 라벨 위 · 세그먼트 전폭, 768 이상은 라벨이
 * 세그먼트 **왼쪽**이고 두 필드가 한 줄이다. 세그먼트는 46 이다 (390 · 1280 실측, 2026-09-29).
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
            <p className="text-body-2 text-fg-muted break-keep">
              {messages.walkCourse.listDescription}
            </p>
          }
          tools={
            <div
              aria-hidden
              className={cn('mt-4 flex flex-col gap-4 md:flex-row md:gap-8', INSET_CLASS.card)}
            >
              {/* 라벨 폭은 `활동량` · `정렬` 두 낱말의 폭이다 */}
              {['w-8', 'w-6'].map((labelWidth) => (
                <div
                  key={labelWidth}
                  className="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-3"
                >
                  <div className="flex h-4.5 shrink-0 items-center">
                    <Skeleton className={cn('h-3.5', labelWidth)} />
                  </div>
                  <Skeleton className="h-11.5 w-full rounded-md md:w-44" />
                </div>
              ))}
            </div>
          }
          aria-busy
        >
          {/* 결과 수 줄 — `WalkCourseListSection` 의 로딩 갈래와 같은 칸 */}
          <div aria-hidden className={cn('border-border border-t pt-4 pb-3', INSET_CLASS.card)}>
            <Skeleton className="h-5.5 w-20" />
          </div>
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
