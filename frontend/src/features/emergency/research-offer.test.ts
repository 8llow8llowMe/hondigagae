import { describe, expect, it } from 'vitest'

import { RESEARCH_OFFER_RATIO, shouldOfferResearch } from '@/features/emergency/research-offer'
import { JEJU_MAP_SEA_RATIO } from '@/lib/geo/coord'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'
import { haversineMeters } from '@/lib/geo/distance'
import { framedCenterLat, type MapBounds } from '@/lib/map/viewport'

/*
  **#396.** `/places` 는 지도를 옮기면 스스로 재조회하지만 이 화면은 그러지 않는다 —
  재조회하면 거리가 지도 중심 기준이 되어 "가까운 순 · 480m" 이 거짓이 되기 때문이다
  (PR #373). 재조회 시점을 사용자가 쥐되, **권할 때와 아닐 때를 이 함수가 가른다.**
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
        selected: false,
      }),
    ).toBe(true)
  })

  it('조금만 움직였으면 권하지 않는다 — 손이 스친 정도로 뜨면 안 된다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(JEJU, 500)),
        origin: JEJU,
        radius: 10_000,
        selected: false,
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

    expect(shouldOfferResearch({ bounds, origin: JEJU, radius: 1_000, selected: false })).toBe(true)
    expect(shouldOfferResearch({ bounds, origin: JEJU, radius: 40_000, selected: false })).toBe(
      false,
    )
  })

  it('임계값이 반경의 30% 다', () => {
    expect(RESEARCH_OFFER_RATIO).toBe(0.3)

    const radius = 10_000
    const justUnder = boundsAround(movedNorth(JEJU, radius * RESEARCH_OFFER_RATIO - 200))
    const justOver = boundsAround(movedNorth(JEJU, radius * RESEARCH_OFFER_RATIO + 200))

    expect(shouldOfferResearch({ bounds: justUnder, origin: JEJU, radius, selected: false })).toBe(
      false,
    )
    expect(shouldOfferResearch({ bounds: justOver, origin: JEJU, radius, selected: false })).toBe(
      true,
    )
  })
})

describe('shouldOfferResearch — 권하지 않을 때 (#396)', () => {
  /*
    선택은 지도를 도로 단계(`SELECTED_FACILITY_MAP_LEVEL`)까지 확대시키므로 중심이
    그만큼 옮겨 간다. 그것은 사용자가 "다른 지역을 보겠다" 고 한 것이 아니라 우리가
    확대한 결과다 — 그 자리에 버튼이 뜨면 고를 때마다 재조회를 권하는 꼴이 된다.
  */
  it('시설을 고른 동안에는 권하지 않는다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(JEJU, 9_000)),
        origin: JEJU,
        radius: 10_000,
        selected: true,
      }),
    ).toBe(false)
  })

  it('첫 idle 전(bounds 없음)이거나 카메라가 아직 놓기 전(origin 없음)이면 권하지 않는다', () => {
    expect(
      shouldOfferResearch({ bounds: null, origin: JEJU, radius: 10_000, selected: false }),
    ).toBe(false)
    expect(
      shouldOfferResearch({
        bounds: boundsAround(JEJU),
        origin: null,
        radius: 10_000,
        selected: false,
      }),
    ).toBe(false)
  })

  it('반경이 값이 아니면 권하지 않는다 — 0 으로 나눈 비율에 기대지 않는다', () => {
    const bounds = boundsAround(movedNorth(JEJU, 9_000))

    expect(shouldOfferResearch({ bounds, origin: JEJU, radius: 0, selected: false })).toBe(false)
    expect(shouldOfferResearch({ bounds, origin: JEJU, radius: Number.NaN, selected: false })).toBe(
      false,
    )
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
        selected: false,
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
        selected: false,
      }),
    ).toBe(true)
  })

  it('놓인 자리에서 사용자가 반경의 30% 밖으로 끌면 권한다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(placed, RADIUS * RESEARCH_OFFER_RATIO + 200)),
        origin: placed,
        radius: RADIUS,
        selected: false,
      }),
    ).toBe(true)
  })
})
