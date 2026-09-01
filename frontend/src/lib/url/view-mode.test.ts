import { describe, expect, it } from 'vitest'

import { parseViewMode, viewModeHref } from '@/lib/url/view-mode'

describe('parseViewMode', () => {
  it('키가 없으면 목록이다 — 지도가 첫 화면이 아니다', () => {
    expect(parseViewMode({})).toBe('list')
  })

  it('view=map 을 읽는다', () => {
    expect(parseViewMode({ view: 'map' })).toBe('map')
  })

  it('URLSearchParams 도 같은 결과다 — server/client 가 같은 값을 봐야 한다', () => {
    expect(parseViewMode(new URLSearchParams('view=map'))).toBe('map')
  })

  it('모르는 값은 예외 없이 목록으로 떨어뜨린다 — URL 은 사용자가 손으로 고친다', () => {
    expect(parseViewMode({ view: 'satellite' })).toBe('list')
  })

  it('반복 키는 첫 값만 읽는다', () => {
    expect(parseViewMode({ view: ['map', 'list'] })).toBe('map')
  })
})

describe('viewModeHref', () => {
  it('기본값(목록)은 URL 에서 생략한다', () => {
    expect(viewModeHref('/places', '', 'list')).toBe('/places')
  })

  it('지도는 키를 붙인다', () => {
    expect(viewModeHref('/places', '', 'map')).toBe('/places?view=map')
  })

  it('필터를 유지한 채 전환한다 — 조건이 풀리면 마커가 갑자기 늘어난다', () => {
    expect(viewModeHref('/places', 'indoor=true', 'map')).toBe('/places?indoor=true&view=map')
  })

  it('지도에서 목록으로 되돌릴 때 view 만 지운다', () => {
    expect(viewModeHref('/places', 'indoor=true&view=map', 'list')).toBe('/places?indoor=true')
  })

  it('왕복해도 같은 URL 이다', () => {
    const toMap = viewModeHref('/places', 'contentType=RESTAURANT', 'map')
    const backToList = viewModeHref('/places', new URL(toMap, 'http://x').search.slice(1), 'list')

    expect(backToList).toBe('/places?contentType=RESTAURANT')
  })
})
