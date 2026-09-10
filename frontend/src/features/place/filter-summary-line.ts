import { CONTENT_TYPE_LABEL, INDOOR_LABEL, SIGUNGU_LABEL } from '@/features/place/filter-labels'
import { messages } from '@/lib/messages'
import type { PlaceFilters } from '@/types/place'

/**
 * 걸린 조건을 한 줄로 — 아트보드 `03 목록 — 데스크톱` 의 `제주시 · 산책로 · 반려견 동반 가능`.
 *
 * **"적용된 필터" 칩 줄과 다르다.** 저건 없앴다 (디자인 가이드 §5: 컨트롤이 이미 보여주면
 * 요약 칩 줄은 두지 않는다). 이건 제목 아래 **부제**라 지울 수 있는 컨트롤이 아니라
 * "지금 무엇을 보고 있는가" 의 서술이다. 모바일에서는 칩이 바로 아래 있어 렌더하지 않는다.
 *
 * 아트보드는 끝에 `— 17곳` 을 붙였으나 `SliceResponse` 가 총 건수를 주지 않아 뺀다.
 * 순수 함수라 node 환경에서 그대로 테스트한다 (docs/testing-guide.md §1).
 */
export function filterSummaryLine(filters: PlaceFilters): string {
  const parts: string[] = []

  if (filters.keyword !== null) {
    parts.push(filters.keyword)
  }
  if (filters.sigunguCode !== null) {
    parts.push(SIGUNGU_LABEL[filters.sigunguCode] ?? filters.sigunguCode)
  }
  if (filters.contentType !== null) parts.push(CONTENT_TYPE_LABEL[filters.contentType])
  if (filters.indoor !== null) {
    parts.push(filters.indoor ? INDOOR_LABEL.indoor : INDOOR_LABEL.outdoor)
  }
  if (filters.petAllowanceType === 'ALLOWED') parts.push(messages.place.filterAllowedOnly)
  if (filters.petSizeType !== null) parts.push(messages.place.filterPetSizeLabel)

  // 아무 조건도 없으면 화면 설명으로 돌아간다 — 빈 줄을 남기지 않는다
  return parts.length === 0 ? messages.place.pageDescription : parts.join(' · ')
}
