import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { mapEmptyCopy, searchEmptyCopy } from '@/lib/place/search-empty'

describe('searchEmptyCopy — 검색어가 걸린 0건 (#431 · #1155)', () => {
  it('무엇으로 찾았는지 되돌려 준다', () => {
    expect(searchEmptyCopy('협재').title).toBe(
      messages.place.searchEmptyTitle.replace('{keyword}', '협재'),
    )
  })

  it('한 단어면 다른 말 · 필터를 함께 짚는다', () => {
    expect(searchEmptyCopy('협재').description).toBe(messages.place.searchEmptyDescription)
  })

  /*
    **띄어 쓴 검색은 지금 서버에서 한 덩어리로 대조된다** — "애월 카페" 는 이름에도 주소에도
    그 문자열이 통째로 없어 0건이다 (2026-10-06 사용성 점검 · BE #1161). 어떻게 하면 찾는지 말한다.
  */
  it('띄어 쓴 검색어면 단어 하나로 찾으라고 말한다', () => {
    expect(searchEmptyCopy('애월 카페').description).toBe(
      messages.place.searchEmptyMultiWordDescription,
    )
  })
})

describe('mapEmptyCopy — 지도 보기의 빈 목록 (#1155)', () => {
  it('검색어로 받은 결과가 아예 없으면 검색어 탓이다 — 지역 탓으로 말하지 않는다', () => {
    const copy = mapEmptyCopy({ keyword: '애월 카페', fetchedCount: 0, radiusBounded: false })

    expect(copy.title).toBe(messages.place.searchEmptyTitle.replace('{keyword}', '애월 카페'))
    expect(copy.title).not.toBe(messages.map.emptyInView)
    expect(copy.action).toBe('clearKeyword')
  })

  it('받은 결과가 조회 영역 밖에만 있으면 지역 문구 그대로다', () => {
    const copy = mapEmptyCopy({ keyword: '애월', fetchedCount: 3, radiusBounded: false })

    expect(copy.title).toBe(messages.map.emptyInView)
    expect(copy.description).toBe(messages.map.emptyInViewDescription)
    expect(copy.action).toBeNull()
  })

  it('검색어가 없으면 지역 문구 그대로다', () => {
    const copy = mapEmptyCopy({ keyword: null, fetchedCount: 0, radiusBounded: false })

    expect(copy.title).toBe(messages.map.emptyInView)
    expect(copy.action).toBeNull()
  })
})

describe('mapEmptyCopy — 반경 조회의 검색어 0건 (#1332)', () => {
  it('장소가 없다가 아니라 지도 범위 안에 없다고 말하고 검색어를 되돌려 준다', () => {
    const copy = mapEmptyCopy({ keyword: '수월봉', fetchedCount: 0, radiusBounded: true })

    expect(copy.title).toContain('지도 범위 안')
    expect(copy.title).toContain('‘수월봉’')
    expect(copy.title).not.toContain('{keyword}')
    expect(copy.description).toBe(messages.map.searchEmptyInRangeDescription)
  })

  it('다음 행동은 제주 전체에서 찾기다 — 검색어 지우기가 아니다', () => {
    expect(mapEmptyCopy({ keyword: '수월봉', fetchedCount: 0, radiusBounded: true }).action).toBe(
      'searchWider',
    )
  })

  it('반경 조회가 아니면 지금 문구 그대로다 — 장소 탭 문구는 바뀌지 않는다', () => {
    const copy = mapEmptyCopy({ keyword: '수월봉', fetchedCount: 0, radiusBounded: false })

    expect(copy.title).toBe(messages.place.searchEmptyTitle.replace('{keyword}', '수월봉'))
    expect(copy.description).toBe(messages.place.searchEmptyDescription)
  })

  it('반경 조회라도 결과가 영역 밖에만 있으면 지역 문구다', () => {
    const copy = mapEmptyCopy({ keyword: '수월봉', fetchedCount: 2, radiusBounded: true })

    expect(copy.title).toBe(messages.map.emptyInView)
    expect(copy.action).toBeNull()
  })

  it('검색어가 없으면 반경 조회라도 지역 문구다', () => {
    expect(mapEmptyCopy({ keyword: null, fetchedCount: 0, radiusBounded: true }).action).toBeNull()
  })
})
