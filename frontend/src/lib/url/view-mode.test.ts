import { describe, expect, it } from 'vitest'

import {
  EMERGENCY_DEFAULT_VIEW,
  parseViewMode,
  PLACES_DEFAULT_VIEW,
  viewModeHref,
} from '@/lib/url/view-mode'

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

/**
 * **화면마다 기본 보기가 다르다.** 장소 찾기는 지도가 먼저고(`/places` = 지도), 긴급
 * 시설은 목록이 먼저다. 기본값을 상수 하나로 통일하면 한쪽이 반드시 틀어진다.
 *
 * 파싱과 링크 생성에 **같은 기본값**이 들어가야 하는 것이 이 규약의 핵심이다 — 어긋나면
 * 토글이 가리키는 보기와 페이지가 그리는 보기가 달라져 전환이 먹지 않는다.
 */
describe('화면별 기본 보기 — 장소 찾기는 지도가 먼저다', () => {
  it('장소 찾기는 view 가 없으면 지도다', () => {
    expect(parseViewMode({}, PLACES_DEFAULT_VIEW)).toBe('map')
  })

  it('잘못된 값도 그 화면의 기본값으로 떨어진다', () => {
    expect(parseViewMode({ view: 'satellite' }, PLACES_DEFAULT_VIEW)).toBe('map')
  })

  it('명시된 목록은 그대로 목록이다', () => {
    expect(parseViewMode({ view: 'list' }, PLACES_DEFAULT_VIEW)).toBe('list')
  })

  it('기본값(지도)은 URL 에서 생략되고 목록이 view=list 로 붙는다', () => {
    expect(viewModeHref('/places', '', 'map', PLACES_DEFAULT_VIEW)).toBe('/places')
    expect(viewModeHref('/places', '', 'list', PLACES_DEFAULT_VIEW)).toBe('/places?view=list')
  })

  it('필터를 유지한 채 전환한다', () => {
    expect(viewModeHref('/places', 'indoor=true', 'list', PLACES_DEFAULT_VIEW)).toBe(
      '/places?indoor=true&view=list',
    )
  })

  it('왕복하면 처음 URL 로 돌아온다 — 링크와 파싱이 같은 기본값을 쓴다', () => {
    const toList = viewModeHref('/places', 'contentType=RESTAURANT', 'list', PLACES_DEFAULT_VIEW)
    const query = new URL(toList, 'http://x').search.slice(1)

    expect(parseViewMode(new URLSearchParams(query), PLACES_DEFAULT_VIEW)).toBe('list')
    expect(viewModeHref('/places', query, 'map', PLACES_DEFAULT_VIEW)).toBe(
      '/places?contentType=RESTAURANT',
    )
  })

  it('긴급 시설은 그대로 목록이 기본이다 — 기본값을 통일하지 않는다', () => {
    expect(parseViewMode({})).toBe('list')
    expect(viewModeHref('/emergency', '', 'list')).toBe('/emergency')
  })
})

describe('EMERGENCY_DEFAULT_VIEW', () => {
  it('긴급 시설의 기본 보기는 지도다', () => {
    expect(EMERGENCY_DEFAULT_VIEW).toBe('map')
  })

  it('빈 쿼리는 지도로 떨어진다', () => {
    expect(parseViewMode({}, EMERGENCY_DEFAULT_VIEW)).toBe('map')
  })

  it('기본값인 지도는 URL 에서 생략되고 목록이 붙는다', () => {
    expect(viewModeHref('/emergency', '', 'map', EMERGENCY_DEFAULT_VIEW)).toBe('/emergency')
    expect(viewModeHref('/emergency', '', 'list', EMERGENCY_DEFAULT_VIEW)).toBe(
      '/emergency?view=list',
    )
  })

  it('장소 찾기와 같은 값이다 — 두 지도 화면의 URL 모양이 같아야 한다', () => {
    expect(EMERGENCY_DEFAULT_VIEW).toBe(PLACES_DEFAULT_VIEW)
  })
})
