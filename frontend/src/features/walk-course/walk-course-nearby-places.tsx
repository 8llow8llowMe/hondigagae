import { Surface, SurfaceList } from '@/components/surface'
import { PlaceRow } from '@/features/place/place-row'
import { PlaceRowSkeleton } from '@/features/place/place-row-skeleton'
import { messages } from '@/lib/messages'
import type { NearbyPlaceItem } from '@/types/place'

/**
 * 한 화면에 세울 장소 수.
 *
 * **곁다리는 분량으로도 곁다리여야 한다.** 상세의 주된 행동은 `일정에 담기` 이고, 이
 * 섹션이 길어지면 코스 상세가 장소 목록 화면처럼 읽힌다. 서버는 최대 50건을 내려 주므로
 * (`NEARBY_MAX_SIZE`) 자르는 자리는 화면 쪽이다.
 */
export const WALK_COURSE_NEARBY_LIMIT = 3

/**
 * 코스에서 **나가는 길** ([#826](https://github.com/8llow8llowMe/hondigagae/issues/826)).
 *
 * ### 이 화면이 고립돼 있었다
 *
 * 들어오는 길은 홈 배너 하나뿐이고, 들어온 뒤 장소·일정으로 이어지는 길이 **없었다**.
 * 전역 nav 에 넣지 않기로 한 결정(공통명세 S6-1)은 그대로 두되, 그 결정이 "코스 화면을
 * 막다른 길로 둔다" 까지 뜻하지는 않는다.
 *
 * ### 왜 시작점 근처인가
 *
 * 코스가 가진 좌표는 **시작점 하나**다 (`endLat`/`endLng` 는 계약에만 있고 dev 값이
 * 0/29 다 — 인계 명세 §2-3). 그래서 이 섹션이 약속하는 것도 시작점 반경까지다. 제목이
 * `코스 근처` 가 아니라 `시작점 근처` 인 이유가 그것이다.
 *
 * ### 전체 보기 링크가 없다
 *
 * `/places` 는 URL 로 지도 중심을 받지 못한다 (`lib/url/place-filters.ts` 에 `lat`/`lng`
 * 가 없다). 링크를 달면 시작점과 무관한 제주 전체 목록으로 떨어져 **누른 것과 닿는 곳이
 * 어긋난다** — #810 이 배너에서 잡은 것과 같은 종류다. 열리면 그때 단다.
 *
 * ### 0건·좌표 없음·조회 실패가 한 자리로 온다
 *
 * 호출부가 세 경우 모두 빈 배열을 넘기고, 여기서는 **섹션 자체를 만들지 않는다**
 * (`indoor-alternatives-section` 과 같은 판단). 곁다리에 `다시 시도` 를 달면 상세 화면의
 * 주된 행동이 흐려진다.
 *
 * **로딩 골격은 그린다.** 비어 있을 때 사라지는 섹션이라 골격도 사라질 수 있는데, 그 점프를
 * 받아들이는 이유는 반대쪽이 더 나쁘기 때문이다 — 골격이 없으면 스크롤을 내린 사람 아래로
 * 섹션이 뒤늦게 끼어들어 읽던 자리가 밀린다. 0건은 예외적인 경우다.
 */
export function WalkCourseNearbyPlaces({
  places,
  loading,
}: {
  places: NearbyPlaceItem[]
  loading: boolean
}) {
  /*
    **코스 자신을 뺀다.** 올레 코스는 장소 DB 에도 등록돼 있어(`[제주올레 1코스] 시흥-광치기
    올레`, contentType `LEPORTS`) 시작점 좌표 조회에 **항상 자기 자신이 0m 로 잡힌다** —
    2026-09-22 dev 실측 29/29 가 그랬고, 세 자리뿐인 섹션에서 한 자리를 언제나 잃는다.

    **거리로 가른다 — 제목 문자열로 가르지 않는다.** `3코스 (A)` 와 `3-A코스` 처럼 코스
    이름과 장소 이름의 표기가 달라 문자열 매칭은 코스마다 어긋난다. 같은 실측에서
    **0m 인 항목 31건이 전부 올레 코스였고 올레가 아닌 0m 는 하나도 없었다** (31 인 것은
    3코스 A·B 가 같은 좌표라 서로의 것까지 잡히기 때문이다 — 그 둘도 함께 빠지는 게 맞다).

    시작점 좌표에 정확히 앉은 진짜 장소가 생기면 그 하나를 잃는다. 오늘 dev 에는 없다.
  */
  const shown = places.filter((item) => item.distanceMeters > 0).slice(0, WALK_COURSE_NEARBY_LIMIT)

  if (!loading && shown.length === 0) return null

  return (
    <Surface title={messages.walkCourse.nearbyPlacesHeading}>
      {shown.length === 0 ? (
        <SurfaceList aria-busy>
          {Array.from({ length: WALK_COURSE_NEARBY_LIMIT }, (_, index) => (
            <PlaceRowSkeleton key={index} />
          ))}
        </SurfaceList>
      ) : (
        <SurfaceList>
          {shown.map(({ place }) => (
            <PlaceRow key={place.placeId} place={place} />
          ))}
        </SurfaceList>
      )}
    </Surface>
  )
}
