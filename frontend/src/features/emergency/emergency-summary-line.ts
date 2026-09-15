import { countsAreComplete } from '@/features/emergency/facility-filters'
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
 * 카드 부제 — `제주 {total}곳 · 지금 진료중 {openNow}곳` (#639).
 *
 * **숫자를 셀 수 없으면 `null` 을 돌려준다.** 두 경우다:
 *  - 응답 전 — 숫자 없는 부제는 빈 말이다
 *  - 목록이 잘렸을 때(`countsAreComplete === false`) — 받아 오지 못한 곳이 남아 있어
 *    "지금 진료중 100곳" 이 **전체가 아니다.** 칩이 같은 조건에서 이미 숫자를 빼는데
 *    (`facility-filters.ts`) 부제만 확언하면 같은 화면 안에서 비대칭이다.
 *
 * `totalCount` 는 자르기 전 총계라 그 자체로는 참이지만(#297), 옆에 선 진료중 수가
 * 참이 아닌 채 한 줄에 묶이면 줄 전체가 거짓말이 된다 — 그래서 줄째로 감춘다.
 *
 * 순수 함수라 node 환경에서 그대로 테스트한다.
 */
export function emergencyHeadSubtitle(result: NearbyFacilityResult | null): string | null {
  if (result === null || !countsAreComplete(result)) return null

  const openNow = result.facilities.filter((facility) => facility.openNow === true).length

  return messages.emergency.subtitle
    .replace('{total}', String(result.totalCount))
    .replace('{openNow}', String(openNow))
}
