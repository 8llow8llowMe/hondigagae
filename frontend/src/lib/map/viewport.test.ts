import { describe, expect, it } from 'vitest'

import {
  boundsCenter,
  boundsRadiusMeters,
  framedCamera,
  framedCenterLat,
  isSameViewport,
  isWithinBounds,
  levelForSpanMeters,
  type MapBounds,
  metersPerPixel,
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

/**
 * **SDK 없이 확대 단계를 미터로 환산한다.** 지도를 만들기 전에 첫 중심을 정해야 해서
 * `map.getBounds()` 를 쓸 수 없고(만든 뒤에 옮기면 `idle` 이 한 번 더 불려 사용자의
 * 이동으로 세어진다), 환산식이 `lib/map/viewport.ts` 에 고정돼 있다.
 * 그 식이 실측 두 건을 재현하는지 여기서 잡는다.
 */
describe('metersPerPixel', () => {
  it('단계가 1 오르면 두 배가 된다 — 카카오는 작을수록 확대다', () => {
    expect(metersPerPixel(9)).toBe(metersPerPixel(8) * 2)
    expect(metersPerPixel(10)).toBe(metersPerPixel(9) * 2)
  })

  it('level 10 은 128 m/px 이다 — 실측 129.5 와 1% 안에서 맞는다', () => {
    expect(metersPerPixel(10)).toBe(128)
  })

  it('level 7 · 1280×656 의 경계 반경이 11km 대다 — coord.ts 에 적힌 실측을 재현한다', () => {
    const corner = Math.hypot(640, 328) * metersPerPixel(7)

    expect(Math.round(corner / 1000)).toBe(12)
  })
})

describe('framedCenterLat', () => {
  const ANCHOR = 33.52

  it('바다 비율 0.5 면 기준 위도가 그대로 중심이다', () => {
    expect(framedCenterLat(ANCHOR, 656, 9, 0.5)).toBeCloseTo(ANCHOR, 10)
  })

  it('바다를 위쪽 35% 로 줄이면 중심이 기준선보다 남쪽으로 내려간다', () => {
    expect(framedCenterLat(ANCHOR, 656, 9, 0.35)).toBeLessThan(ANCHOR)
  })

  it('기준 위도가 화면 위쪽 35% 지점에 온다 — 뷰포트 높이가 달라도 같은 구도다', () => {
    for (const heightPx of [600, 656, 830, 1200]) {
      const centerLat = framedCenterLat(ANCHOR, heightPx, 9, 0.35)
      const latSpan = (metersPerPixel(9) * heightPx) / 111_320
      // 화면 위 끝은 중심보다 위도 half 만큼 높다. 기준선까지의 거리 / 전체 높이 = 0.35
      const fromTop = (centerLat + latSpan / 2 - ANCHOR) / latSpan

      expect(fromTop).toBeCloseTo(0.35, 10)
    }
  })

  it('높이가 0 이면 대체값으로 계산한다 — 중심이 기준선(바다)으로 올라가지 않는다', () => {
    expect(framedCenterLat(ANCHOR, 0, 9, 0.35)).toBeLessThan(ANCHOR)
  })
})

describe('levelForSpanMeters', () => {
  /*
    반경 10km = 지름 20km. 카카오는 level 이 작을수록 확대이고
    픽셀당 미터가 `0.25 × 2^(level-1)` 이다.
  */
  it('반경 10km 를 375px 에 담으면 level 9 다 (64m/px × 375 = 24km)', () => {
    expect(levelForSpanMeters(20_000, 375)).toBe(9)
  })

  it('같은 반경을 800px 에 담으면 한 단계 더 확대된다 (32m/px × 800 = 25.6km)', () => {
    expect(levelForSpanMeters(20_000, 800)).toBe(8)
  })

  it('반경을 넓히면 단계가 따라 올라간다 — "보는 범위 = 조회한 범위"', () => {
    expect(levelForSpanMeters(40_000, 375)).toBe(10)
    expect(levelForSpanMeters(80_000, 375)).toBe(11)
  })

  it('딱 맞는 폭은 담기는 것으로 본다 (경계 포함)', () => {
    // level 8 · 375px = 12,000m
    expect(levelForSpanMeters(12_000, 375)).toBe(8)
    expect(levelForSpanMeters(12_001, 375)).toBe(9)
  })

  it('픽셀을 모르면(0) 대체 높이로 계산한다 — 0 을 그대로 쓰면 최대 축소가 된다', () => {
    // FALLBACK_HEIGHT_PX(640) 기준: level 9 = 64 × 640 = 40,960m
    expect(levelForSpanMeters(20_000, 0)).toBe(levelForSpanMeters(20_000, 640))
  })

  it('아무리 넓어도 카카오 상한 14 를 넘기지 않는다', () => {
    expect(levelForSpanMeters(40_000_000, 375)).toBe(14)
  })

  it('폭이 0 이하면 최대 축소로 떨어뜨린다 — 계산 불가를 예외로 던지지 않는다', () => {
    expect(levelForSpanMeters(0, 375)).toBe(14)
    expect(levelForSpanMeters(-1, 375)).toBe(14)
  })
})

describe('framedCamera', () => {
  const anchor = { lat: 33.4996213, lng: 126.5311884 }

  it('짧은 변으로 단계를 정한다 — 긴 변으로 맞추면 짧은 변에서 잘린다', () => {
    const wide = framedCamera({
      anchor,
      spanMeters: 20_000,
      width: 1280,
      height: 800,
      seaRatio: 0.35,
    })

    expect(wide.level).toBe(levelForSpanMeters(20_000, 800))
  })

  it('경도는 anchor 그대로다 — 틀잡기는 위도만 옮긴다', () => {
    const camera = framedCamera({
      anchor,
      spanMeters: 20_000,
      width: 375,
      height: 700,
      seaRatio: 0.35,
    })

    expect(camera.lng).toBe(anchor.lng)
  })

  it('seaRatio 0.35 면 중심이 anchor 보다 남쪽이다 — anchor 가 화면 위쪽에 온다', () => {
    const camera = framedCamera({
      anchor,
      spanMeters: 20_000,
      width: 375,
      height: 700,
      seaRatio: 0.35,
    })

    expect(camera.lat).toBeLessThan(anchor.lat)
  })

  it('seaRatio 0.5 면 anchor 가 그대로 중심이다', () => {
    const camera = framedCamera({
      anchor,
      spanMeters: 20_000,
      width: 375,
      height: 700,
      seaRatio: 0.5,
    })

    expect(camera.lat).toBeCloseTo(anchor.lat, 10)
  })

  it('framedCenterLat 과 같은 값을 준다 — 두 경로가 갈리면 첫 화면 구도가 달라진다', () => {
    const camera = framedCamera({
      anchor,
      spanMeters: 20_000,
      width: 375,
      height: 700,
      seaRatio: 0.35,
    })

    expect(camera.lat).toBe(framedCenterLat(anchor.lat, 700, camera.level, 0.35))
  })
})
