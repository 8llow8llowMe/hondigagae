import { describe, expect, it } from 'vitest'

import { toLatLng } from '@/lib/geo/coord'
import { placeSummary, placeWithoutCoordinate } from '@/test/fixtures/place'

describe('toLatLng', () => {
  it('lat 을 위도, lng 을 경도로 매핑한다 (카카오는 LatLng(위도, 경도) 순서다)', () => {
    const result = toLatLng(placeSummary)

    expect(result).toEqual({ lat: 33.3608276172, lng: 126.7818122232 })
  })

  it('제주 좌표가 위도/경도 범위 안에 있다', () => {
    const result = toLatLng(placeSummary)

    // 위도(33)와 경도(126)를 뒤집으면 위도 126 이 되어 범위를 벗어난다
    expect(result?.lat).toBeLessThan(90)
    expect(result?.lng).toBeGreaterThan(90)
  })

  it('좌표가 null 인 장소는 null 을 반환한다 (마커를 그리지 않는다)', () => {
    expect(toLatLng(placeWithoutCoordinate)).toBeNull()
  })

  it('좌표가 0 이면 null 을 반환한다 (지도가 기니 만으로 튀는 것을 막는다)', () => {
    expect(toLatLng({ lat: 0, lng: 0 })).toBeNull()
    expect(toLatLng({ lat: 33.5, lng: 0 })).toBeNull()
  })

  it('범위를 벗어난 좌표는 null 을 반환한다', () => {
    expect(toLatLng({ lat: 126.78, lng: 33.36 })).toBeNull()
  })

  it('NaN 은 null 을 반환한다', () => {
    expect(toLatLng({ lat: Number.NaN, lng: 126.78 })).toBeNull()
  })

  it('undefined 는 null 을 반환한다', () => {
    expect(toLatLng({ lat: undefined, lng: undefined })).toBeNull()
  })
})
