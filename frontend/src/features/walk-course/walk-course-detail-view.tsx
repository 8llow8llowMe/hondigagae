'use client'

import { useWalkTimes } from '@/features/insight/use-walk-times'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import { useNearbyPlaces } from '@/features/place/use-nearby-places'
import { useWalkCourseDetail } from '@/features/walk-course/use-walk-course-detail'
import { WalkCourseDetailSection } from '@/features/walk-course/walk-course-detail-section'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { toPetCondition } from '@/lib/api/insight'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import { toCoursePosition } from '@/lib/walk-course/coordinates'

/**
 * 시작점 근처 장소를 찾는 반경(m) ([#826](https://github.com/8llow8llowMe/hondigagae/issues/826)).
 *
 * **걸어서 닿는 거리다.** 코스를 걸으러 온 사람에게 "근처" 는 차로 가는 거리가 아니다.
 * 넓히면 건수는 늘지만 시작점과 무관한 곳이 섞여 `시작점 근처` 라는 제목이 거짓이 된다.
 *
 * **서버 응답의 `radius` 를 다시 읽지 않는다** — 우리가 보낸 값을 그대로 돌려준다.
 */
const NEARBY_RADIUS_METERS = 2000

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
  backHref,
}: {
  walkCourseId: string
  /** 미로그인에는 `GET /members/me/pets` 를 내지 않는다 (#200 · 공통명세 S1) */
  authed: boolean
  /** 목록으로 돌아갈 주소 — 라우트가 `searchParams` 에서 만들어 준다 (#783) */
  backHref?: string | undefined
}) {
  const query = useWalkCourseDetail(walkCourseId)
  const { pet } = useSelectedPet(authed)

  const course = query.data ?? null
  const position = course === null ? null : toCoursePosition(course)
  const walkTimes = useWalkTimes(position, toPetCondition(pet))
  /*
    **골든타임과 같은 좌표를 쓴다** — 둘 다 시작점 하나에 걸려 있고, 좌표가 없으면
    `position === null` 이라 요청 자체가 나가지 않는다 (`enabled`).

    **필터는 기본값이다.** 장소 목록에서 고른 조건은 이 화면의 것이 아니다 — 코스 상세는
    장소 목록에서 오는 화면이 아니라서 이어받을 조건이 없고, 있지도 않은 조건을 흉내 내면
    사용자가 좁힌 적 없는 결과를 좁혀서 보여 주게 된다.
  */
  const nearby = useNearbyPlaces(
    position,
    NEARBY_RADIUS_METERS,
    DEFAULT_PLACE_FILTERS,
    position !== null,
  )

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
      /*
        **실패를 빈 배열로 접는다** (#826). 0건 · 좌표 없음 · 조회 실패에 화면이 같은 답을
        하므로(섹션을 만들지 않는다) 여기서 셋을 합쳐 넘긴다 — 가르면 화면이 다시 합쳐야 한다.
      */
      nearbyPlaces={nearby.data?.places ?? []}
      nearbyPlacesLoading={position !== null && nearby.isPending}
      authed={authed}
      /*
        **판정의 기준이 될 아이가 있는가** ([#777](https://github.com/8llow8llowMe/hondigagae/issues/777)).
        조회에 조건을 싣는 값과 **같은 `pet`** 을 쓴다 — 안내가 약속하는 변화가 바로 이
        값이 바뀌는 것이라, 다른 출처를 보면 안내와 판정이 서로 다른 아이를 가리킨다.
      */
      petRegistered={pet !== null}
      backHref={backHref}
    />
  )
}
