import { countsAreComplete, narrowByKeyword } from '@/features/emergency/facility-filters'
import type { EmergencyBasis } from '@/features/emergency/resolve-anchor'
import type { JejuRegionCode } from '@/lib/geo/jeju-regions'
import { messages } from '@/lib/messages'
import type { NearbyFacilityResult } from '@/types/emergency'

/**
 * 긴급 시설 카드 머리의 문자열 둘 — 기준 줄과 부제.
 *
 * **예전에는 `emergencySummaryLine`(조건 한 줄, #419)이 여기 있었다.** 데스크톱 전용
 * 둘째 부제였는데, 1280 실측에서 `10.0km` 홀로 서서 무슨 값인지 읽히지 않아 걷었다
 * (#639) — 반경은 좌측 필터 레일의 선택값과 목록 위 요약 줄(`가까운 순 · 반경 10.0km`)이
 * 이미 말한다. `/places` 의 `filterSummaryLine` 은 그대로 남아 있다.
 *
 * 순수 함수라 node 환경에서 그대로 테스트한다 (docs/testing-guide.md §1).
 */
/**
 * 거리·정렬이 **무엇을 기준으로 한 값인지** 한 마디로 — 요약 줄 오른쪽 (#639).
 *
 * **네 갈래를 한 곳에 둔다.** 예전에는 목록(`EmergencySection`)이 두 갈래, 지도
 * (`EmergencyMapView`)가 세 갈래를 각자 인라인으로 갖고 있어 `region` 이 늘었을 때
 * 한쪽만 고쳐질 자리였다 — 그러면 목록은 "서귀포 기준" 이라 말하고 지도는 "제주 중심
 * 기준" 이라 말하는 같은 화면이 된다.
 *
 * `region` 인데 `regionCode` 가 없는 조합은 만들어지지 않지만(`resolveAnchor` 가 둘을
 * 함께 정한다), 타입으로 못 박을 수 없는 자리라 제주 중심으로 떨어뜨린다 — 거짓 라벨
 * 대신 가장 약한 주장을 남긴다.
 */
export function emergencyBasisLabel(
  basis: EmergencyBasis,
  regionCode: JejuRegionCode | null,
): string {
  if (basis === 'map') return messages.emergency.basisMap
  if (basis === 'current') return messages.emergency.basisCurrent

  if (basis === 'region' && regionCode !== null) {
    return messages.emergency.basisRegion.replace(
      '{region}',
      messages.emergency.regionLabel[regionCode],
    )
  }

  return messages.emergency.basisJeju
}

/**
 * 카드 부제 — `{region} {total}곳 · 지금 진료중 {openNow}곳` (#639 · #675).
 *
 * **숫자를 셀 수 없으면 `null` 을 돌려준다.** 세 경우다:
 *  - 응답 전 — 숫자 없는 부제는 빈 말이다
 *  - 목록이 잘렸을 때(`countsAreComplete === false`) — 받아 오지 못한 곳이 남아 있어
 *    "지금 진료중 100곳" 이 **전체가 아니다.** 칩이 같은 조건에서 이미 숫자를 빼는데
 *    (`facility-filters.ts`) 부제만 확언하면 같은 화면 안에서 비대칭이다.
 *  - `total === 0` — 0곳·0곳 짜리 줄은 정보가 없다. 잘린 목록에서 침묵하는 것과 같은
 *    결의 판단이다 (#675 D16-6).
 *
 * **세는 배열은 `narrowByKeyword` 를 통과한 것이다 — 칩 축(유형·24시간·지금 진료중)은
 * 세지 않는다.** 칩까지 태우면(`applyFilters`) `지금 진료중 {openNow}곳` 이 언제나 목록
 * 수와 같아져 줄이 아무것도 알려주지 못한다. 칩 때문에 목록만 0건이어도 부제는 남는다
 * — `‘청사’ 1곳 · 지금 진료중 0곳` 은 0건 본문과 싸우지 않고 그 이유(relief 버튼과 같은
 * 근거)를 말한다 (#675 D16-2 · D16-6).
 *
 * **검색 중에는 `total` 이 검색 결과 수다.** 서버가 `keyword` 를 모르므로(#584) 검색
 * 축의 총계는 서버에서 올 수 없고, `countsAreComplete` 가 통과한 뒤라 화면에서 센 수가
 * 곧 전량이다. `totalCount`(자르기 전 서버 총계, #297)는 검색이 없을 때만 쓴다 — 검색
 * 중에 그대로 쓰면 "반경 안 총계" 와 "검색 결과" 가 뒤섞여 ①번 현상(#675 D16-1)이
 * 재발한다.
 *
 * **`{region}` 은 `emergencyBasisLabel` 과 같은 출처를 쓴다.** 검색 중에는 지역명을
 * 붙이지 않는다 — 검색 중 가장 강한 조건은 검색어이고, 지역은 바로 옆 기준 줄이
 * 계속 말한다.
 *
 * 순수 함수라 node 환경에서 그대로 테스트한다.
 */
export function emergencyHeadSubtitle(
  result: NearbyFacilityResult | null,
  keyword: string | null,
  regionCode: JejuRegionCode | null,
): string | null {
  if (result === null || !countsAreComplete(result)) return null

  const narrowed = narrowByKeyword(result.facilities, keyword)
  const openNow = narrowed.filter((facility) => facility.openNow === true).length
  const total = keyword === null ? result.totalCount : narrowed.length

  if (total === 0) return null

  if (keyword !== null) {
    return messages.emergency.subtitleKeyword
      .replace('{keyword}', keyword)
      .replace('{total}', String(total))
      .replace('{openNow}', String(openNow))
  }

  const region =
    regionCode !== null
      ? messages.emergency.regionLabel[regionCode]
      : messages.emergency.subtitleRegionAll

  return messages.emergency.subtitle
    .replace('{region}', region)
    .replace('{total}', String(total))
    .replace('{openNow}', String(openNow))
}
