'use client'

import { useWalkTimes } from '@/features/insight/use-walk-times'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import { useWalkCourseDetail } from '@/features/walk-course/use-walk-course-detail'
import { WalkCourseDetailSection } from '@/features/walk-course/walk-course-detail-section'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { toPetCondition } from '@/lib/api/insight'
import { toCoursePosition } from '@/lib/walk-course/coordinates'

/**
 * 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다.
 *
 * ### 골든타임을 부르는 조건은 하나다 — 좌표 (D3-1)
 *
 * `toCoursePosition` 이 좌표 없는 코스에 `null` 을 돌려주고, `useWalkTimes` 의 `enabled` 가
 * `position !== null` 이라 **요청 자체가 나가지 않는다.** 실측 29개 중 25개가 그 경우다.
 *
 * **`lat ?? 0` 을 쓰지 않는다** — 서버가 `(0, 0)` 에 **200 으로 답한다** (공통명세 S4-2).
 *
 * ### 반려견 조건은 nav 선택견이다 — 목록의 대표견과 일부러 다르다
 *
 * 목록의 활동량은 *카탈로그를 좁히는 조건*이고 이쪽은 *판정의 기준*이다. 판정 화면
 * (홈·장소 상세)은 전부 nav 선택견을 쓰므로 여기서만 대표견을 쓰면 "몽실이 기준" 이
 * 화면마다 다른 아이를 가리킨다 (`코스상세-세부명세.md` D3 · D8-2).
 *
 * **골든타임 key 를 새로 만들지 않는다.** `insightKeys.walkTimes` 는 **좌표 축**이라
 * 홈에서 같은 좌표·같은 조건으로 받아 뒀으면 그대로 재사용된다.
 */
export function WalkCourseDetailView({
  walkCourseId,
  authed,
}: {
  walkCourseId: string
  /** 미로그인에는 `GET /members/me/pets` 를 내지 않는다 (#200 · 공통명세 S1) */
  authed: boolean
}) {
  const query = useWalkCourseDetail(walkCourseId)
  const { pet } = useSelectedPet(authed)

  const course = query.data ?? null
  const position = course === null ? null : toCoursePosition(course)
  const walkTimes = useWalkTimes(position, toPetCondition(pet))

  return (
    <WalkCourseDetailSection
      course={course}
      loading={query.isPending}
      errorStatus={toErrorStatus(query.error)}
      errorMessage={query.error instanceof ApiError ? query.error.rawMessage : undefined}
      onRetry={() => void query.refetch()}
      walkTimes={walkTimes.data ?? null}
      walkTimesLoading={position !== null && walkTimes.isPending}
      onWalkTimesRetry={() => void walkTimes.refetch()}
    />
  )
}
