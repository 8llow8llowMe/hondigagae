import { describe, expect, it } from 'vitest'

import { placeFilterHref } from '@/features/place/use-place-filter-nav'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

/**
 * 회귀 고정 — **목록에서 필터를 만지면 지도로 튀던 버그**.
 *
 * `/places` 의 기본 보기는 지도라(`PLACES_DEFAULT_VIEW`) 목록은 `?view=list` 로만 존재한다.
 * 조건만 새로 직렬화하면 그 키가 통째로 사라져 페이지가 지도로 되돌아갔다.
 */
const withRegion: PlaceFilters = { ...DEFAULT_PLACE_FILTERS, sigunguCode: '4' }

describe('placeFilterHref', () => {
  it('목록 보기에서 필터를 바꿔도 view=list 가 남는다 — 이것이 사라지면 지도로 튄다', () => {
    const href = placeFilterHref('/places', withRegion, 'list')

    expect(href).toContain('view=list')
    expect(href).toContain('sigunguCode=4')
  })

  it('목록 보기에서 필터를 전부 풀어도 view=list 가 남는다 — 초기화도 보기를 바꾸지 않는다', () => {
    expect(placeFilterHref('/places', DEFAULT_PLACE_FILTERS, 'list')).toBe('/places?view=list')
  })

  it('지도 보기는 기본값이라 view 를 URL 에 적지 않는다 — 빈 URL 이 곧 지도다', () => {
    expect(placeFilterHref('/places', DEFAULT_PLACE_FILTERS, 'map')).toBe('/places')
    expect(placeFilterHref('/places', withRegion, 'map')).not.toContain('view=')
  })

  it('지도 보기에서 필터를 바꿔도 조건은 그대로 실린다', () => {
    expect(placeFilterHref('/places', withRegion, 'map')).toContain('sigunguCode=4')
  })
})
