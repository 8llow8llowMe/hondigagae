import { describe, expect, it } from 'vitest'

import { RESEARCH_OFFER_RATIO, shouldOfferResearch } from '@/features/emergency/research-offer'
import type { MapBounds } from '@/lib/map/viewport'

/*
  **#396.** `/places` 는 지도를 옮기면 스스로 재조회하지만 이 화면은 그러지 않는다 —
  재조회하면 거리가 지도 중심 기준이 되어 "가까운 순 · 480m" 이 거짓이 되기 때문이다
  (PR #373). 재조회 시점을 사용자가 쥐되, **권할 때와 아닐 때를 이 함수가 가른다.**
*/

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
        anchor: JEJU,
        radius,
        selected: false,
      }),
    ).toBe(true)
  })

  it('조금만 움직였으면 권하지 않는다 — 손이 스친 정도로 뜨면 안 된다', () => {
    expect(
      shouldOfferResearch({
        bounds: boundsAround(movedNorth(JEJU, 500)),
        anchor: JEJU,
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

    expect(shouldOfferResearch({ bounds, anchor: JEJU, radius: 1_000, selected: false })).toBe(true)
    expect(shouldOfferResearch({ bounds, anchor: JEJU, radius: 40_000, selected: false })).toBe(
      false,
    )
  })

  it('임계값이 반경의 30% 다', () => {
    expect(RESEARCH_OFFER_RATIO).toBe(0.3)

    const radius = 10_000
    const justUnder = boundsAround(movedNorth(JEJU, radius * RESEARCH_OFFER_RATIO - 200))
    const justOver = boundsAround(movedNorth(JEJU, radius * RESEARCH_OFFER_RATIO + 200))

    expect(shouldOfferResearch({ bounds: justUnder, anchor: JEJU, radius, selected: false })).toBe(
      false,
    )
    expect(shouldOfferResearch({ bounds: justOver, anchor: JEJU, radius, selected: false })).toBe(
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
        anchor: JEJU,
        radius: 10_000,
        selected: true,
      }),
    ).toBe(false)
  })

  it('첫 idle 전(bounds 없음)이거나 좌표를 못 받았으면(anchor 없음) 권하지 않는다', () => {
    expect(
      shouldOfferResearch({ bounds: null, anchor: JEJU, radius: 10_000, selected: false }),
    ).toBe(false)
    expect(
      shouldOfferResearch({
        bounds: boundsAround(JEJU),
        anchor: null,
        radius: 10_000,
        selected: false,
      }),
    ).toBe(false)
  })

  it('반경이 값이 아니면 권하지 않는다 — 0 으로 나눈 비율에 기대지 않는다', () => {
    const bounds = boundsAround(movedNorth(JEJU, 9_000))

    expect(shouldOfferResearch({ bounds, anchor: JEJU, radius: 0, selected: false })).toBe(false)
    expect(shouldOfferResearch({ bounds, anchor: JEJU, radius: Number.NaN, selected: false })).toBe(
      false,
    )
  })
})
