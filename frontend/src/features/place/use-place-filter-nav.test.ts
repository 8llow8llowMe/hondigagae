import { describe, expect, it } from 'vitest'

import { placeFilterHref } from '@/features/place/use-place-filter-nav'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import { PLACES_DEFAULT_VIEW, PLAN_ADD_DEFAULT_VIEW } from '@/lib/url/view-mode'
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

/**
 * 담기 화면(`/plans/{planId}/days/{day}/add`)이 같은 훅을 쓴다 — 이슈 #1012.
 *
 * 필터 칩·레일에 이어 **검색도** 이 화면에 섰다. 훅은 경로를 `usePathname()` 에서 받으므로
 * 제출해도 `/places` 로 튀지 않는다 — 그 전제를 여기서 고정한다.
 */
describe('placeFilterHref — 담기 화면 경로 (#1012)', () => {
  const PLAN_ADD = '/plans/223456789012000001/days/1/add'
  const withKeyword: PlaceFilters = { ...DEFAULT_PLACE_FILTERS, keyword: '미술관' }

  it('검색어를 실어도 담기 경로가 그대로다', () => {
    const href = placeFilterHref(PLAN_ADD, withKeyword, 'list')

    expect(href.startsWith(`${PLAN_ADD}?`)).toBe(true)
    expect(href).toContain(`keyword=${encodeURIComponent('미술관')}`)
    expect(href).toContain('view=list')
  })

  it('검색어를 지우면 담기 경로만 남는다 — 지도가 기본 보기다', () => {
    expect(placeFilterHref(PLAN_ADD, DEFAULT_PLACE_FILTERS, 'map')).toBe(PLAN_ADD)
    expect(placeFilterHref(PLAN_ADD, DEFAULT_PLACE_FILTERS, 'list')).toBe(`${PLAN_ADD}?view=list`)
  })

  /*
    **훅은 경로와 무관하게 `PLACES_DEFAULT_VIEW` 로 `view` 를 읽고 쓴다.** 담기 화면은 자기
    상수(`PLAN_ADD_DEFAULT_VIEW`)를 갖는데 두 값이 지금 같아서 맞게 돈다. 한쪽만 바뀌면
    담기 화면에서 검색·칩을 만질 때 보기가 뒤집힌다 — 그때는 훅이 기본 보기를 받아야 한다.
  */
  it('담기 화면의 기본 보기가 /places 와 같다 — 갈리면 훅이 기본값을 받아야 한다', () => {
    expect(PLAN_ADD_DEFAULT_VIEW).toBe(PLACES_DEFAULT_VIEW)
  })
})
