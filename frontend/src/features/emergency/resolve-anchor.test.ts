import { describe, expect, it } from 'vitest'

import { resolveAnchor, showsDistance } from '@/features/emergency/resolve-anchor'
import { JEJU_QUERY_CENTER, type PositionResult } from '@/lib/geo/current-position'
import { JEJU_REGION_CENTERS } from '@/lib/geo/jeju-regions'

const MAP_CENTER = { lat: 33.3, lng: 126.7 }
const GRANTED: PositionResult = { kind: 'granted', lat: 33.51, lng: 126.52 }
const DENIED: PositionResult = { ...JEJU_QUERY_CENTER, kind: 'fallback', reason: 'denied' }

/**
 * 기준점 우선순위 — `searchCenter > region > granted > jeju` (세부명세 D3-1).
 *
 * **훅에서 떼어 낸 순수 함수다.** `useEmergencyBoard` 는 위치·조회·라우터를 한꺼번에 쥐고
 * 있어 node 환경에서 렌더할 수 없는데, 여기서 지켜야 하는 것은 렌더가 아니라 **네 입력이
 * 하나의 기준점으로 접히는 규칙**이다 (docs/testing-guide.md §1).
 */
describe('resolveAnchor — 기준점 우선순위 (#639)', () => {
  it('지도 재검색이 가장 세다 — 사용자가 마지막에 한 행동이 지도다', () => {
    const result = resolveAnchor({
      searchCenter: MAP_CENTER,
      regionCode: 'SEOGWIPO',
      position: GRANTED,
    })

    expect(result.anchor).toEqual(MAP_CENTER)
    expect(result.basis).toBe('map')
  })

  it('권역은 현재 위치보다 세다 — 방금 직접 고른 자리다', () => {
    const result = resolveAnchor({ searchCenter: null, regionCode: 'EAST', position: GRANTED })

    expect(result.anchor).toEqual(JEJU_REGION_CENTERS.EAST)
    expect(result.basis).toBe('region')
  })

  it('아무것도 고르지 않았고 위치를 받았으면 현재 위치다', () => {
    const result = resolveAnchor({ searchCenter: null, regionCode: null, position: GRANTED })

    expect(result.anchor).toEqual({ lat: 33.51, lng: 126.52 })
    expect(result.basis).toBe('current')
  })

  it('위치가 폴백이면 제주 중심이다', () => {
    const result = resolveAnchor({ searchCenter: null, regionCode: null, position: DENIED })

    expect(result.anchor).toEqual({ lat: JEJU_QUERY_CENTER.lat, lng: JEJU_QUERY_CENTER.lng })
    expect(result.basis).toBe('jeju')
  })

  /*
    **아직 묻는 중이면 조회하지 않는다.** `anchor` 가 `null` 이면 `useNearbyFacilities` 가
    쿼리를 걸지 않는다 — 여기서 제주 중심을 미리 넣으면 좌표가 오기 전에 한 번, 온 뒤에
    또 한 번 조회가 나간다.
  */
  it('위치를 확인하는 중이면 기준점이 없다', () => {
    const result = resolveAnchor({ searchCenter: null, regionCode: null, position: null })

    expect(result.anchor).toBeNull()
    expect(result.basis).toBe('current')
  })

  /* 권역은 좌표를 기다리지 않는다 — 폴백이 확정되기 전에 눌러도 그 자리로 간다 */
  it('위치를 확인하는 중에 권역을 고르면 권역이 이긴다', () => {
    const result = resolveAnchor({ searchCenter: null, regionCode: 'WEST', position: null })

    expect(result.anchor).toEqual(JEJU_REGION_CENTERS.WEST)
    expect(result.basis).toBe('region')
  })

  /*
    **`region` 에서는 거리를 보여준다.** 제주 중심 폴백(`jeju`)은 사용자가 고르지 않은
    자리라 "480m" 가 거짓말이 되지만, 권역은 직접 고른 자리다 — 그 자리에서 480m 인 것은
    알고 싶은 사실이다 (`basisMap` 이 #396 에서 같은 판단을 했다).
  */
  it('거리를 감추는 것은 제주 중심 폴백뿐이다', () => {
    expect(
      resolveAnchor({ searchCenter: MAP_CENTER, regionCode: null, position: DENIED }).basis,
    ).toBe('map')

    const region = resolveAnchor({ searchCenter: null, regionCode: 'JEJU_CITY', position: DENIED })
    expect(region.basis).toBe('region')
  })

  /*
    **제주시 권역과 제주 중심 폴백은 같은 좌표지만 다른 기준이다.** 좌표가 같다고 `jeju` 로
    묶으면 사용자가 직접 고른 사실이 지워져 거리가 다시 감춰진다.
  */
  it('제주시를 고르면 좌표가 폴백과 같아도 region 이다', () => {
    const result = resolveAnchor({ searchCenter: null, regionCode: 'JEJU_CITY', position: DENIED })

    expect(result.anchor).toBe(JEJU_REGION_CENTERS.JEJU_CITY)
    expect(result.basis).toBe('region')
  })
})

describe('showsDistance — 거리를 감추는 것은 제주 중심 폴백뿐이다', () => {
  it('jeju 만 false 다', () => {
    expect(showsDistance('jeju')).toBe(false)
    expect(showsDistance('current')).toBe(true)
    expect(showsDistance('map')).toBe(true)
    /* 권역은 사용자가 직접 고른 자리다 — 그 자리에서 480m 는 참이다 */
    expect(showsDistance('region')).toBe(true)
  })
})
