import { describe, expect, it } from 'vitest'

import {
  boundsCenter,
  boundsRadiusMeters,
  isSameViewport,
  isWithinBounds,
  type MapBounds,
} from '@/lib/map/viewport'

/** 협재 일대. 제주는 위도 33 / 경도 126 이다 */
const HANLIM: MapBounds = {
  sw: { lat: 33.38, lng: 126.22 },
  ne: { lat: 33.42, lng: 126.28 },
}

describe('isWithinBounds', () => {
  it('영역 안의 좌표를 통과시킨다', () => {
    expect(isWithinBounds(HANLIM, { lat: 33.4, lng: 126.25 })).toBe(true)
  })

  it('경계선 위의 좌표를 포함으로 본다', () => {
    expect(isWithinBounds(HANLIM, HANLIM.sw)).toBe(true)
    expect(isWithinBounds(HANLIM, HANLIM.ne)).toBe(true)
  })

  it('위도만 벗어나도 제외한다', () => {
    expect(isWithinBounds(HANLIM, { lat: 33.5, lng: 126.25 })).toBe(false)
  })

  it('경도만 벗어나도 제외한다', () => {
    expect(isWithinBounds(HANLIM, { lat: 33.4, lng: 126.5 })).toBe(false)
  })

  it('위도·경도를 뒤집어 넣으면 제외된다 — 좌표 순서 사고를 여기서 잡는다', () => {
    expect(isWithinBounds(HANLIM, { lat: 126.25, lng: 33.4 })).toBe(false)
  })
})

describe('boundsCenter', () => {
  it('두 모서리의 중점이다', () => {
    const center = boundsCenter(HANLIM)

    // 부동소수 오차가 있다 — 좌표는 항상 근사 비교한다
    expect(center.lat).toBeCloseTo(33.4, 6)
    expect(center.lng).toBeCloseTo(126.25, 6)
  })
})

describe('boundsRadiusMeters', () => {
  it('중심에서 모서리까지를 반경으로 삼는다 — 변의 절반이 아니다', () => {
    const radius = boundsRadiusMeters(HANLIM)

    // 위도 0.02° ≈ 2.2km, 경도 0.03° ≈ 2.8km → 대각선 ≈ 3.6km
    expect(radius).toBeGreaterThan(3_000)
    expect(radius).toBeLessThan(4_200)
  })

  it('최대 확대 시에도 하한을 지킨다 — 반경 0 은 아무것도 잡지 못한다', () => {
    const tiny: MapBounds = {
      sw: { lat: 33.4, lng: 126.25 },
      ne: { lat: 33.4001, lng: 126.2501 },
    }

    expect(boundsRadiusMeters(tiny)).toBe(300)
  })

  it('백엔드 상한(50km)을 넘기지 않는다', () => {
    const huge: MapBounds = {
      sw: { lat: 30, lng: 124 },
      ne: { lat: 36, lng: 129 },
    }

    expect(boundsRadiusMeters(huge)).toBe(50_000)
  })
})

describe('isSameViewport', () => {
  it('아직 영역을 모르면 같지 않다고 본다 — 첫 조회는 반드시 나가야 한다', () => {
    expect(isSameViewport(null, HANLIM)).toBe(false)
    expect(isSameViewport(HANLIM, null)).toBe(false)
  })

  it('손가락이 스친 정도의 이동은 같은 영역으로 본다', () => {
    const nudged: MapBounds = {
      sw: { lat: 33.3801, lng: 126.2201 },
      ne: { lat: 33.4201, lng: 126.2801 },
    }

    expect(isSameViewport(HANLIM, nudged)).toBe(true)
  })

  it('임계값을 넘겨 이동하면 다른 영역이다', () => {
    const moved: MapBounds = {
      sw: { lat: 33.39, lng: 126.23 },
      ne: { lat: 33.43, lng: 126.29 },
    }

    expect(isSameViewport(HANLIM, moved)).toBe(false)
  })

  it('중심이 같아도 확대·축소했으면 다른 영역이다', () => {
    const zoomed: MapBounds = {
      sw: { lat: 33.39, lng: 126.235 },
      ne: { lat: 33.41, lng: 126.265 },
    }

    expect(isSameViewport(HANLIM, zoomed)).toBe(false)
  })
})
