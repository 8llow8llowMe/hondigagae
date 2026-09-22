import { describe, expect, it } from 'vitest'

import { JEJU_MAP_SEA_RATIO } from '@/lib/geo/coord'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'
import { haversineMeters } from '@/lib/geo/distance'
import { RESEARCH_OFFER_RATIO, shouldOfferResearch } from '@/lib/map/research-offer'
import { boundsRadiusMeters, framedCenterLat, type MapBounds } from '@/lib/map/viewport'

/*
  **#396.** 두 지도 화면(`/emergency` · `/places`) 모두 지도를 옮겼다고 스스로 재조회하지
  않는다 — 재조회 시점을 사용자가 쥐되, **권할 때와 아닐 때를 이 함수가 가른다.**

  걷은 이유는 화면마다 다르다: `/emergency` 는 거리가 지도 중심 기준이 되어 "가까운 순 ·
  480m" 이 거짓이 되고(PR #373), `/places` 는 한 곳을 고르거나 조금 옮길 때마다 목록이
  통째로 다시 조회돼 방금 보던 결과가 사라진다.
*/

/** 카메라가 지도 중심을 놓은 자리. **조회 기준점이 아니다** — #578 */
const JEJU = { lat: 33.4996, lng: 126.5312 }

/** 중심이 `center` 이고 대략 `spanDeg` 만큼 벌어진 영역 */
function boundsAround(center: { lat: number; lng: number }, spanDeg = 0.02): MapBounds {
  return {
    sw: { lat: center.lat - spanDeg, lng: center.lng - spanDeg },
    ne: { lat: center.lat + spanDeg, lng: center.lng + spanDeg },
  }
}

/** 위도로 대략 `meters` 만큼 북쪽으로 옮긴 점 (위도 1도 ≈ 111.32km) */
function movedNorth(from: { lat: number; lng: number }, meters: number) {
  return { lat: from.lat + meters / 111_320, lng: from.lng }
}

describe('shouldOfferResearch — 권할 때 (#396)', () => {
  it('조회 반경의 30% 를 넘게 옮기면 권한다', () => {
    const radius = 10_000

    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(JEJU, 4_000)),
        origin: JEJU,
        radius,
        suppressed: false,
      }),
    ).toBe(true)
  })

  it('조금만 움직였으면 권하지 않는다 — 손이 스친 정도로 뜨면 안 된다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(JEJU, 500)),
        origin: JEJU,
        radius: 10_000,
        suppressed: false,
      }),
    ).toBe(false)
  })

  /*
    **임계값이 반경에 비례하는 것이 이 함수의 값어치다.** 같은 300m 이동이라도
    반경 1km 에서는 큰 이동이고 반경 40km 에서는 손이 스친 정도다. 고정 미터로 두면
    넓은 반경에서 버튼이 계속 뜨고 좁은 반경에서는 화면 밖으로 나가도 안 뜬다.
  */
  it('같은 이동 거리라도 반경이 좁으면 권하고 넓으면 권하지 않는다', () => {
    const bounds = boundsAround(movedNorth(JEJU, 800))

    expect(shouldOfferResearch({ bounds, origin: JEJU, radius: 1_000, suppressed: false })).toBe(
      true,
    )
    expect(shouldOfferResearch({ bounds, origin: JEJU, radius: 40_000, suppressed: false })).toBe(
      false,
    )
  })

  it('임계값이 반경의 30% 다', () => {
    expect(RESEARCH_OFFER_RATIO).toBe(0.3)

    const radius = 10_000
    const justUnder = boundsAround(movedNorth(JEJU, radius * RESEARCH_OFFER_RATIO - 200))
    const justOver = boundsAround(movedNorth(JEJU, radius * RESEARCH_OFFER_RATIO + 200))

    expect(
      shouldOfferResearch({ bounds: justUnder, origin: JEJU, radius, suppressed: false }),
    ).toBe(false)
    expect(shouldOfferResearch({ bounds: justOver, origin: JEJU, radius, suppressed: false })).toBe(
      true,
    )
  })
})

describe('shouldOfferResearch — 권하지 않을 때 (#396)', () => {
  /*
    `suppressed` 는 **"판정 근거를 아직 못 믿는 동안"** 이다. 우리가 카메라를 옮겨 놓고
    그 결과를 아직 재지 못한 구간(`/emergency` 의 `boundsStale`)이 그렇다 — 그 어긋남으로
    판정하면 우리가 확대한 것을 사용자의 이동으로 읽는다.
  */
  it('근거를 못 믿는 동안에는 권하지 않는다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(JEJU, 9_000)),
        origin: JEJU,
        radius: 10_000,
        suppressed: true,
      }),
    ).toBe(false)
  })

  /*
    **이 자리는 예전에 `selected` 였다.** 그래서 시설을 고른 뒤에는 사용자가 지도를
    직접 끌어도 버튼이 뜨지 않았고, 옆 동네를 확인하려면 선택부터 풀어야 했다.
    같은 이동을 `suppressed: false` 로 주면 — 진짜 `idle` 이 와서 `bounds` 를 다시
    믿을 수 있게 된 순간이다 — 고른 상태와 무관하게 권한다.
  */
  it('근거를 되찾으면 고른 상태와 무관하게 권한다 (회귀)', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(JEJU, 9_000)),
        origin: JEJU,
        radius: 10_000,
        suppressed: false,
      }),
    ).toBe(true)
  })

  it('첫 idle 전(bounds 없음)이거나 카메라가 아직 놓기 전(origin 없음)이면 권하지 않는다', () => {
    expect(
      shouldOfferResearch({ bounds: null, origin: JEJU, radius: 10_000, suppressed: false }),
    ).toBe(false)
    expect(
      shouldOfferResearch({
        bounds: boundsAround(JEJU),
        origin: null,
        radius: 10_000,
        suppressed: false,
      }),
    ).toBe(false)
  })

  it('반경이 값이 아니면 권하지 않는다 — 0 으로 나눈 비율에 기대지 않는다', () => {
    const bounds = boundsAround(movedNorth(JEJU, 9_000))

    expect(shouldOfferResearch({ bounds, origin: JEJU, radius: 0, suppressed: false })).toBe(false)
    expect(
      shouldOfferResearch({ bounds, origin: JEJU, radius: Number.NaN, suppressed: false }),
    ).toBe(false)
  })
})

/*
  **확대·축소만으로도 권하는 갈래** — `originScreenRadius`.

  `/places` 는 조회 반경을 화면에서 역산하므로(`boundsRadiusMeters`) 축소가 곧 "더 넓게
  찾아 줘" 다. 중심이 한 픽셀도 안 움직여도 재조회할 이유가 생긴다.

  `/emergency` 는 반경이 URL 이 소유하는 칩 값이고 재검색이 그 값을 그대로 두므로 이
  갈래를 켜지 않는다 — 켜면 줌으로 뜬 버튼을 눌러도 조회 범위가 그대로다.
*/
describe('shouldOfferResearch — 확대·축소 (#396)', () => {
  const base = boundsAround(JEJU, 0.02)
  const screenRadius = boundsRadiusMeters(base)

  it('중심이 그대로여도 화면 반경이 30% 넘게 달라지면 권한다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(JEJU, 0.01), // 반경 절반 — 50% 변화
        origin: JEJU,
        radius: screenRadius,
        suppressed: false,
        originScreenRadius: screenRadius,
      }),
    ).toBe(true)
  })

  it('한 뼘 줌은 권하지 않는다 — 중심 이동과 같은 30% 를 쓴다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(JEJU, 0.0244), // 22% 변화
        origin: JEJU,
        radius: screenRadius,
        suppressed: false,
        originScreenRadius: screenRadius,
      }),
    ).toBe(false)
  })

  /* 넘기지 않은 화면(`/emergency`)에서는 줌이 판정에 아예 들어오지 않는다 */
  it('originScreenRadius 를 주지 않으면 줌만으로는 권하지 않는다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(JEJU, 0.01),
        origin: JEJU,
        radius: screenRadius,
        suppressed: false,
      }),
    ).toBe(false)
  })

  it('화면 반경이 값이 아니면 줌 갈래를 타지 않는다 — 0 으로 나눈 비율에 기대지 않는다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(JEJU, 0.01),
        origin: JEJU,
        radius: screenRadius,
        suppressed: false,
        originScreenRadius: 0,
      }),
    ).toBe(false)
  })
})

/*
  **이 함수가 `anchor` 가 아니라 `origin` 을 받는 이유** — 이슈 #578.

  지도를 놓는 규칙(`framedCenterLat`)은 기준점을 화면 정중앙이 아니라 위쪽
  `JEJU_MAP_SEA_RATIO`(35%) 지점에 놓는다. 그래서 **지도 중심은 기준점보다 남쪽**이고,
  그 거리는 확대 단계에 비례한다. 예전에는 여기에 기준점을 넘겨 **그 의도된 오프셋이
  사용자의 이동으로 읽혔다** — 조작 0회에서 버튼이 떴다.

  아래 둘은 실측값(1440×900 · level 8 · 반경 10km 에서 4,060m)을 재현하는 구성이다.
*/
describe('프레이밍 오프셋을 사용자 이동으로 읽지 않는다 (#578)', () => {
  /** 첫 화면 실측 — 데스크톱 1440×900 의 지도 높이와 그때의 확대 단계 */
  const MAP_HEIGHT_PX = 836
  const MAP_LEVEL = 8
  const RADIUS = 10_000

  /** 카메라가 실제로 놓는 자리. 기준점보다 `(0.5 - seaRatio)` 만큼 남쪽이다 */
  const placed = {
    lat: framedCenterLat(JEJU_QUERY_CENTER.lat, MAP_HEIGHT_PX, MAP_LEVEL, JEJU_MAP_SEA_RATIO),
    lng: JEJU_QUERY_CENTER.lng,
  }

  it('조작 0회 — 카메라가 놓은 자리로 재면 권하지 않는다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(placed),
        origin: placed,
        radius: RADIUS,
        suppressed: false,
      }),
    ).toBe(false)
  })

  /*
    **프레이밍 규칙을 바꾸면 이 검사가 깨진다 — 그때는 지우지 말고 다시 판단한다.**
    `seaRatio` 가 0.5 가 되면 오프셋이 사라져 위험 자체가 없어지고, 더 치우치면
    위험이 커진다. 어느 쪽이든 `origin` 의 존재 이유가 달라지는 변경이다.
  */
  it('그 오프셋은 임계값을 넘는다 — 기준점으로 재면 조작 0회에 권해 버렸다 (회귀)', () => {
    const offset = haversineMeters(JEJU_QUERY_CENTER, placed)

    expect(offset).not.toBeNull()
    expect(offset ?? 0).toBeGreaterThan(RADIUS * RESEARCH_OFFER_RATIO)

    expect(
      shouldOfferResearch({
        bounds: boundsAround(placed),
        origin: JEJU_QUERY_CENTER,
        radius: RADIUS,
        suppressed: false,
      }),
    ).toBe(true)
  })

  it('놓인 자리에서 사용자가 반경의 30% 밖으로 끌면 권한다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(placed, RADIUS * RESEARCH_OFFER_RATIO + 200)),
        origin: placed,
        radius: RADIUS,
        suppressed: false,
      }),
    ).toBe(true)
  })
})
