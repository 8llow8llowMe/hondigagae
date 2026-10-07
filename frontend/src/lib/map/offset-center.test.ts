import { describe, expect, it } from 'vitest'

import { offsetCenter } from './offset-center'

/**
 * 선형 가짜 투영 — 화면 중심(500, 400)이 (33, 126)이고 1px 이 0.001° 다.
 * 위도는 화면 아래로 갈수록 줄어든다 (지도와 같은 방향).
 */
const latlng = (lat: number, lng: number) => ({ getLat: () => lat, getLng: () => lng })
const projection = {
  containerPointFromCoords: (l: { getLat: () => number; getLng: () => number }) => ({
    x: 500 + (l.getLng() - 126) / 0.001,
    y: 400 - (l.getLat() - 33) / 0.001,
  }),
  coordsFromContainerPoint: (p: { x: number; y: number }) =>
    latlng(33 - (p.y - 400) * 0.001, 126 + (p.x - 500) * 0.001),
}
const point = (x: number, y: number) => ({ x, y })
const target = latlng(33.1, 126.2)

describe('offsetCenter', () => {
  it('오프셋이 없거나 0 이면 null — 목표가 그대로 중심이다', () => {
    expect(offsetCenter({ projection, point, target, offset: null, scale: 1 })).toBeNull()
    expect(offsetCenter({ projection, point, target, offset: { x: 0, y: 0 }, scale: 1 })).toBeNull()
  })

  it('오른쪽(+x)에 두려면 중심이 서쪽으로 간다', () => {
    const center = offsetCenter({ projection, point, target, offset: { x: 400, y: 0 }, scale: 1 })

    expect(center?.lat).toBeCloseTo(33.1)
    expect(center?.lng).toBeCloseTo(126.2 - 0.4)
  })

  it('위(−y)에 두려면 중심이 남쪽으로 간다 — 모바일 시트가 아래를 덮을 때', () => {
    const center = offsetCenter({ projection, point, target, offset: { x: 0, y: -100 }, scale: 1 })

    expect(center?.lat).toBeCloseTo(33.1 - 0.1)
    expect(center?.lng).toBeCloseTo(126.2)
  })

  it('확대할 단계 차이만큼 좌표 차이를 줄인다 — 9 → 5 면 1/16', () => {
    const center = offsetCenter({
      projection,
      point,
      target,
      offset: { x: 400, y: 0 },
      scale: 2 ** (5 - 9),
    })

    expect(center?.lng).toBeCloseTo(126.2 - 0.4 / 16)
  })
})
