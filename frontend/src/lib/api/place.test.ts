import { describe, expect, it } from 'vitest'

import { nextPlaceCursor, placeListPath } from '@/lib/api/place'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import { placeSummary } from '@/test/fixtures/place'

describe('placeListPath', () => {
  it('기본 필터로 areaCode 와 size 를 포함한 경로를 만든다', () => {
    const path = placeListPath(DEFAULT_PLACE_FILTERS, null)

    expect(path).toContain('/places?')
    expect(path).toContain('areaCode=39')
    expect(path).toContain('size=20')
  })

  it('커서를 lastPlaceId 로 붙인다', () => {
    expect(placeListPath(DEFAULT_PLACE_FILTERS, '212481712381923328')).toContain(
      'lastPlaceId=212481712381923328',
    )
  })
})

describe('nextPlaceCursor', () => {
  it('마지막 항목의 placeId 를 커서로 쓴다', () => {
    const page = { contents: [placeSummary], hasNext: true }

    expect(nextPlaceCursor(page)).toBe(placeSummary.placeId)
  })

  it('hasNext 가 false 면 undefined 를 반환해 조회를 끝낸다', () => {
    expect(nextPlaceCursor({ contents: [placeSummary], hasNext: false })).toBeUndefined()
  })

  it('hasNext 가 true 여도 결과가 비면 undefined 를 반환한다 (무한 루프 방지)', () => {
    expect(nextPlaceCursor({ contents: [], hasNext: true })).toBeUndefined()
  })

  it('페이지가 없으면 undefined 를 반환한다', () => {
    expect(nextPlaceCursor(undefined)).toBeUndefined()
  })
})
