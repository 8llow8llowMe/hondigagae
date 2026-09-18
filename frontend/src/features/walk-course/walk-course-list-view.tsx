'use client'

import { useWalkCourseList } from '@/features/walk-course/use-walk-course-list'
import { useWalkCourseNav } from '@/features/walk-course/use-walk-course-nav'
import {
  WalkCourseActivityField,
  WalkCourseSortField,
} from '@/features/walk-course/walk-course-filter-fields'
import {
  type WalkCourseBasis,
  WalkCourseListSection,
} from '@/features/walk-course/walk-course-list-section'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import type { WalkCourseListParams } from '@/lib/api/walk-course'
import { ACTIVITY_MAX_HOURS } from '@/lib/walk-course/activity'
import type { WalkCourseFilters } from '@/types/walk-course'

/**
 * 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다.
 *
 * **`params` 는 URL 이 아니라 서버가 실제로 보낸 값이다.** 서버 컴포넌트가
 * `resolveActivityParam` 으로 만들어 내려주고, 프리페치와 **같은 key** 가 되도록 그대로
 * 쓴다 (`architecture-guide.md` §9).
 */
export function WalkCourseListView({
  filters,
  params,
  petBasis,
}: {
  filters: WalkCourseFilters
  params: WalkCourseListParams
  /**
   * 기준 줄에 이름을 적을 반려견. **URL 이 비어 대표견으로 채운 경우에만** 온다 —
   * 사용자가 세그먼트로 직접 고른 조건에 반려견 이름을 붙이면 화면이 없는 인과를 말한다
   * (대표견이 `낮음` 인데 사용자가 `6시간 이내` 를 고른 경우).
   */
  petBasis: { name: string; levelName: string } | null
}) {
  const { apply, showAll } = useWalkCourseNav()
  const query = useWalkCourseList(params)

  const data = query.data
  /*
    **기준 줄은 응답의 `petActivityLevelApplied` 로 그린다** (공통명세 S4-1 규칙 5).
    로컬 상태로 판정하면 서버가 파라미터를 무시했을 때 화면만 좁혔다고 말한다.
  */
  const applied = data?.petActivityLevelApplied === true ? params.petActivityLevel : null
  const basis: WalkCourseBasis | null =
    applied === null
      ? null
      : {
          petName: petBasis?.name ?? null,
          levelName: petBasis?.levelName ?? null,
          hours: ACTIVITY_MAX_HOURS[applied],
        }

  return (
    <WalkCourseListSection
      courses={data?.courses ?? []}
      totalCount={data?.totalCount ?? 0}
      basis={basis}
      providerName={data?.providerName ?? null}
      loading={query.isPending}
      errorStatus={toErrorStatus(query.error)}
      errorMessage={query.error instanceof ApiError ? query.error.rawMessage : undefined}
      onRetry={() => void query.refetch()}
      onShowAll={showAll}
      tools={
        /*
          **도구는 카드 머리다** (#556). 두 축이 나란히 서고, 좁은 폭에서는 접힌다 —
          축이 둘뿐이라 좌측 280 레일을 세우지 않는다 (D1).

          **그룹 간격이 24 다** (#734). 12(`gap-3`)였을 때는 두 세그먼트가 테두리·높이·
          간격이 전부 같아 **하나의 5칸짜리 라디오**로 읽혔다 — `활동량 6시간 이내` 를
          고르면 `정렬: 코스 순` 이 풀릴 것처럼 보였다. `FieldGroup` 라벨과 함께 두 축을
          시각적으로 가른다.
        */
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <WalkCourseActivityField
            applied={params.petActivityLevel}
            onChange={(activity) => apply({ ...filters, activity })}
          />
          <WalkCourseSortField
            sort={filters.sort}
            onChange={(sort) => apply({ ...filters, sort })}
          />
        </div>
      }
    />
  )
}
