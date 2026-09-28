import { describe, expect, it } from 'vitest'

import {
  boundsCenter,
  boundsRadiusMeters,
  framedCamera,
  framedCenterLat,
  isSameViewport,
  isWithinBounds,
  levelForBoxMeters,
  levelForSpanMeters,
  type MapBounds,
  metersPerPixel,
  shouldRefit,
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

/*
  #982 — 동선 카드가 그날 장소에 맞춰 확대되지 않았다.

  수치는 이슈의 1일차 세 곳(수월봉 · 생각하는 정원 · 성산일출봉)을 담는 사각형이다 —
  동서 72,453m · 남북 18,156m (`route.test.ts` 가 같은 좌표에서 이 값을 낸다).
  컨테이너는 실측이다 (2026-09-28, MOCK_API 5186 에서 `/plans/{id}` 의 지도 칸):
  1366 데스크톱 **888×256**, 390 모바일 **358×224**.

  기대 단계는 카카오 자신이 답했다 — 5174 에서 같은 크기의 컨테이너에 `setBounds` 를
  걸면 888×256 은 **10**, 358×224 는 **11** 이다. 고치기 전 코드는 둘 다 **12** 였다
  (긴 변 72km × 1.4 를 **짧은 변(높이)** 에 맞췄다).
*/
describe('levelForBoxMeters', () => {
  const ISSUE_BOX = { widthMeters: 72_453, heightMeters: 18_156 }

  it('데스크톱 동선 칸(888×256)에서 10 이다', () => {
    expect(levelForBoxMeters(ISSUE_BOX, 888, 256)).toBe(10)
  })

  it('모바일 동선 칸(358×224)에서 11 이다', () => {
    expect(levelForBoxMeters(ISSUE_BOX, 358, 224)).toBe(11)
  })

  /*
    **가로 폭을 쓴다.** 동서로 긴 사각형은 넓은 컨테이너에서 더 가까이 담긴다 — 높이만
    보면 888 과 358 이 같은 단계가 된다(고치기 전 증상).
  */
  it('같은 높이라도 가로가 넓으면 더 확대된다', () => {
    expect(levelForBoxMeters(ISSUE_BOX, 888, 224)).toBeLessThan(
      levelForBoxMeters(ISSUE_BOX, 358, 224),
    )
  })

  /* 남북으로 긴 사각형은 높이가 정한다 — 축을 서로 바꿔 끼우지 않는다 */
  it('남북으로 긴 사각형은 높이가 단계를 정한다', () => {
    const tall = { widthMeters: 1_000, heightMeters: 30_000 }

    expect(levelForBoxMeters(tall, 888, 256)).toBe(levelForSpanMeters(30_000, 256 - 64))
  })

  /*
    **여백은 픽셀이다** (양쪽 32px). 순번 핀은 지름 32px 원이라 좌표에서 16px 을 차지하고,
    그만큼을 더 띄운다. 비율 여백(× 1.4)은 먼 동선일수록 여백만 커져 한 단계를 통째로
    잃었다 — 72km 에 29km 를 더했다.
  */
  it('양쪽 32px 을 뺀 폭에 담는다 — 경계는 담기는 쪽이다', () => {
    // 294px(358 - 64) × 256 m/px(11) = 75,264m — 이보다 넓으면 한 단계 물러난다
    expect(levelForBoxMeters({ widthMeters: 75_264, heightMeters: 0 }, 358, 224)).toBe(11)
    expect(levelForBoxMeters({ widthMeters: 75_265, heightMeters: 0 }, 358, 224)).toBe(12)
  })

  /* 두 곳이 같은 위도면 남북 폭이 0 이다 — 그 축이 최대 축소(14)로 끌어내리면 안 된다 */
  it('폭이 0 인 축은 단계를 정하지 않는다', () => {
    expect(levelForBoxMeters({ widthMeters: 20_000, heightMeters: 0 }, 888, 256)).toBe(
      levelForSpanMeters(20_000, 888 - 64),
    )
  })

  it('두 축이 모두 0 이면 levelForSpanMeters 와 같이 최대 축소다', () => {
    expect(levelForBoxMeters({ widthMeters: 0, heightMeters: 0 }, 888, 256)).toBe(14)
  })

  /* 탭·시트 뒤에서 만들어지면 clientWidth/Height 가 0 이다 — 최대 축소로 떨어지지 않는다 */
  it('컨테이너 크기가 0 이면 대체 크기로 계산한다', () => {
    expect(levelForBoxMeters(ISSUE_BOX, 0, 0)).toBeLessThan(14)
  })
})

describe('framedCamera — 사각형', () => {
  const anchor = { lat: 33.37735, lng: 126.5528 }

  it('사각형을 받으면 축마다 맞춘 단계를 쓴다', () => {
    const camera = framedCamera({
      anchor,
      spanMeters: { widthMeters: 72_453, heightMeters: 18_156 },
      width: 888,
      height: 256,
      seaRatio: 0.5,
    })

    expect(camera.level).toBe(10)
    expect(camera.lat).toBeCloseTo(anchor.lat, 10)
    expect(camera.lng).toBe(anchor.lng)
  })

  /* 원(지름)은 지금과 같다 — 긴급 시설 · 장소 미니맵 · 올레 시작점 지도가 쓴다 */
  it('숫자(지름)는 여전히 짧은 변으로 정한다', () => {
    const camera = framedCamera({
      anchor,
      spanMeters: 20_000,
      width: 888,
      height: 256,
      seaRatio: 0.5,
    })

    expect(camera.level).toBe(levelForSpanMeters(20_000, 256))
  })
})

/*
  #982 리뷰 M-2 — 칸 크기가 바뀌었을 때 다시 맞출지.

  `MapCanvas` 의 관찰자가 이것만 묻는다. 판정을 소스 문자열로 잠그면 줄 순서만 바뀌어도
  깨지고 정작 수치 경계는 못 본다 — 그래서 순수 함수로 뺐다.
*/
describe('shouldRefit', () => {
  const fitted = { width: 888, height: 256 }

  it('크기가 그대로면 다시 맞추지 않는다 — observe 직후 첫 알림이 이것이다', () => {
    expect(shouldRefit({ fitted, next: { width: 888, height: 256 }, moved: false })).toBe(false)
  })

  it('폭이 바뀌면 다시 맞춘다 — 1366 → 1024', () => {
    expect(shouldRefit({ fitted, next: { width: 640, height: 256 }, moved: false })).toBe(true)
  })

  it('높이가 바뀌면 다시 맞춘다 — md 경계를 넘어 h-64 → h-56', () => {
    expect(shouldRefit({ fitted, next: { width: 888, height: 224 }, moved: false })).toBe(true)
  })

  it('사용자가 옮겼으면 크기가 바뀌어도 다시 맞추지 않는다', () => {
    expect(shouldRefit({ fitted, next: { width: 640, height: 256 }, moved: true })).toBe(false)
  })

  /*
    탭 · 시트 뒤로 숨으면 0 이 된다. 그때 맞추면 대체 크기로 계산한 엉뚱한 틀이 놓이고,
    다시 보일 때 크기가 또 바뀌어 한 번 더 맞춘다 — 보일 때 한 번이면 된다.
  */
  it('칸이 숨어 크기가 0 이면 다시 맞추지 않는다', () => {
    expect(shouldRefit({ fitted, next: { width: 0, height: 256 }, moved: false })).toBe(false)
    expect(shouldRefit({ fitted, next: { width: 888, height: 0 }, moved: false })).toBe(false)
  })
})
