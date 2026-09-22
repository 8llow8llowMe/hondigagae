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
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
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
  petName,
}: {
  filters: WalkCourseFilters
  params: WalkCourseListParams
  /**
   * 기준 줄에 적을 반려견 **이름**. **URL 이 비어 대표견으로 채운 경우에만** 온다 —
   * 사용자가 세그먼트로 직접 고른 조건에 반려견 이름을 붙이면 화면이 없는 인과를 말한다
   * (대표견이 `낮음` 인데 사용자가 `보통` 을 고른 경우).
   *
   * **활동량 이름은 여기 없다** (#735). 응답이 `appliedPetActivityLevel.level.name` 으로
   * 내려주므로 반려견 프로필에서 가져올 이유가 사라졌다.
   */
  petName: string | null
}) {
  const { apply, showAll } = useWalkCourseNav()
  const query = useWalkCourseList(params)

  const data = query.data
  /*
    **기준 줄은 응답의 `appliedPetActivityLevel` 로 그린다** (공통명세 S4-1 규칙 5).
    로컬 상태로 판정하면 서버가 파라미터를 무시했을 때 화면만 좁혔다고 말한다.

    **상한이 없으면(`maxDurationMinutes === null`) 줄을 만들지 않는다.** 그것은 `HIGH` 를
    적용한 응답이고, 기준 줄은 `{limit}` 을 가운데 두고 쓰여 있어(#776 뒤로는 "…이 넘는
    코스는 빼고") 적을 상한이 없으면 문장 자체가 서지 않는다.
    이 화면은 `HIGH` 를 보내지 않으므로(공통명세 S4-1 규칙 3) 우리 요청으로는 오지 않는
    갈래지만, **필터 미적용(`null` 객체)과 뜻이 다른 값**이라 응답 모양대로 가른다.
  */
  const applied = data?.appliedPetActivityLevel ?? null
  const basis: WalkCourseBasis | null =
    applied === null || applied.maxDurationMinutes === null
      ? null
      : {
          petName,
          levelName: applied.level.name,
          maxDurationMinutes: applied.maxDurationMinutes,
        }

  return (
    <WalkCourseListSection
      courses={data?.courses ?? []}
      totalCount={data?.totalCount ?? 0}
      basis={basis}
      filters={filters}
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

          **자기 인셋을 스스로 든다** (#837). `Surface` 는 `{tools}` 를 그대로 뱉고 슬롯이
          인셋을 지는 규약인데(`surface.tsx`), 여기만 빠져 있어 `활동량` · `정렬` 라벨이
          카드 인셋 밖(x=0)에 서고 나머지 콘텐츠(x=16)와 세로선이 갈렸다.
        */
        <div className={cn('flex flex-col gap-4 md:flex-row md:gap-6', INSET_CLASS.card)}>
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
