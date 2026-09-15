import { countsAreComplete } from '@/features/emergency/facility-filters'
import type { EmergencyBasis } from '@/features/emergency/resolve-anchor'
import { formatDistance } from '@/lib/format/distance'
import type { JejuRegionCode } from '@/lib/geo/jeju-regions'
import { messages } from '@/lib/messages'
import type { FacilityFilters, NearbyFacilityResult } from '@/types/emergency'

/**
 * 걸린 조건을 한 줄로 — `/places` 의 `filterSummaryLine` 대응 (#419).
 *
 * 제목 아래 **부제**다. 지울 수 있는 컨트롤이 아니라 "지금 무엇을 보고 있는가" 의 서술이라,
 * 모바일에서는 칩이 바로 아래 있어 렌더하지 않는다.
 *
 * **반경이 항상 첫 자리다.** 이 화면에서 무엇을 보고 있는가의 뼈대가 반경이고 조건은 그 안을
 * 좁힌다. 순서가 조건에 따라 흔들리면 눈이 매번 다시 훑어야 한다.
 *
 * 그래서 `filterSummaryLine` 과 달리 **빈 줄이 될 수 없어** 화면 설명으로 되돌아가는 갈래가
 * 없다 — 반경은 언제나 걸려 있다.
 *
 * **검색어는 넣지 않는다** (#584). 이 줄은 데스크톱에서만 그려지는데, 바로 아래 검색
 * 입력이 같은 폭에서 그 글자를 이미 들고 있다 — 부제에 또 적으면 같은 말이 두 번이다.
 * 칩·레일에는 검색어를 보여주는 자리가 따로 없어 축들만 여기 모인다.
 *
 * 순수 함수라 node 환경에서 그대로 테스트한다 (docs/testing-guide.md §1).
 */
export function emergencySummaryLine(filters: FacilityFilters, radius: number): string {
  const parts: string[] = [formatDistance(radius)]

  if (filters.type !== null) parts.push(messages.emergency.typeByCode[filters.type])
  if (filters.open24Only) parts.push(messages.emergency.open24)
  if (filters.openNowOnly) parts.push(messages.emergency.openNow)

  return parts.join(' · ')
}

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
