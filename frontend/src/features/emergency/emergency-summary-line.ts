import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import type { FacilityFilters } from '@/types/emergency'

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
