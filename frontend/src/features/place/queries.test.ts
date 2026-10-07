import { describe, expect, it } from 'vitest'

import { placeKeys } from '@/features/place/queries'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'

/*
  **거리순 목록은 `/places` 목록과 다른 캐시다** (#1217). 같은 필터라도 기준점이 있으면 순서와
  `distanceMeters` 가 다르다 — 키가 같으면 담기 목록의 거리순 페이지가 `/places` 로 새거나 그 반대가 된다.
*/
describe('placeKeys.list — 기준점 (#1217)', () => {
  it('기준점이 없으면 예전 키 그대로다 — /places 와 지도 패널이 캐시를 나눠 쓴다', () => {
    expect(placeKeys.list(DEFAULT_PLACE_FILTERS, null)).toEqual(
      placeKeys.list(DEFAULT_PLACE_FILTERS),
    )
    expect(placeKeys.list(DEFAULT_PLACE_FILTERS)).toEqual(['places', 'list', DEFAULT_PLACE_FILTERS])
  })

  it('기준점이 있으면 키가 갈린다', () => {
    const near = placeKeys.list(DEFAULT_PLACE_FILTERS, { lat: 33.25, lng: 126.41 })

    expect(near).not.toEqual(placeKeys.list(DEFAULT_PLACE_FILTERS))
    expect(near).not.toEqual(placeKeys.list(DEFAULT_PLACE_FILTERS, { lat: 33.46, lng: 126.31 }))
  })

  it('목록 무효화 접두사(places · list) 아래에 남는다', () => {
    expect(placeKeys.list(DEFAULT_PLACE_FILTERS, { lat: 33.25, lng: 126.41 }).slice(0, 2)).toEqual([
      'places',
      'list',
    ])
  })
})
