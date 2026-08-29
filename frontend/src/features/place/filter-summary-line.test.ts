import { describe, expect, it } from 'vitest'

import { filterSummaryLine } from '@/features/place/filter-summary-line'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'

describe('filterSummaryLine — 제목 아래 부제', () => {
  it('걸린 필터가 없으면 화면 설명으로 돌아간다', () => {
    expect(filterSummaryLine(DEFAULT_PLACE_FILTERS)).toBe(messages.place.pageDescription)
  })

  it('시군구 코드를 라벨로 바꾼다', () => {
    expect(filterSummaryLine({ ...DEFAULT_PLACE_FILTERS, sigunguCode: '4' })).toBe('제주시')
    expect(filterSummaryLine({ ...DEFAULT_PLACE_FILTERS, sigunguCode: '3' })).toBe('서귀포시')
  })

  /** 폐지된 남·북제주군 코드가 URL 로 들어올 수 있다. 라벨이 없으면 코드를 그대로 보인다 */
  it('모르는 시군구 코드는 코드 그대로 둔다', () => {
    expect(filterSummaryLine({ ...DEFAULT_PLACE_FILTERS, sigunguCode: '2' })).toBe('2')
  })

  it('축을 지역 · 유형 · 실내 · 동반 · 크기 순으로 잇는다', () => {
    const line = filterSummaryLine({
      ...DEFAULT_PLACE_FILTERS,
      sigunguCode: '4',
      contentType: 'CULTURE',
      indoor: true,
      petAllowanceType: 'ALLOWED',
    })

    expect(line).toBe(`제주시 · 문화시설 · 실내만 · ${messages.place.filterAllowedOnly}`)
  })

  it('indoor 가 false 면 야외만이다 — null 과 구분한다', () => {
    expect(filterSummaryLine({ ...DEFAULT_PLACE_FILTERS, indoor: false })).toBe('야외만')
  })

  /** 동반 축은 "동반 가능만" 한 갈래다. 다른 코드는 부제에 넣지 않는다 */
  it('petAllowanceType 이 ALLOWED 가 아니면 부제에 넣지 않는다', () => {
    expect(filterSummaryLine({ ...DEFAULT_PLACE_FILTERS, petAllowanceType: 'NOT_ALLOWED' })).toBe(
      messages.place.pageDescription,
    )
  })

  it('반려견 크기 제한을 축으로 센다', () => {
    expect(filterSummaryLine({ ...DEFAULT_PLACE_FILTERS, petSizeType: 'SMALL' })).toBe(
      messages.place.filterPetSizeLabel,
    )
  })

  /** `SliceResponse` 가 총 건수를 주지 않는다. 아트보드의 `— 17곳` 은 지어낼 수 없다 */
  it('결과 건수를 붙이지 않는다', () => {
    expect(filterSummaryLine({ ...DEFAULT_PLACE_FILTERS, sigunguCode: '4' })).not.toContain('곳')
  })
})
