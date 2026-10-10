import { describe, expect, it } from 'vitest'

import { facilitiesPath, MAX_SIZE } from '@/lib/api/emergency'
import {
  FACILITY_LAYER_CENTER,
  FACILITY_LAYER_RADIUS,
  facilityLayerPosition,
} from '@/lib/emergency/facility-layer'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 장소 찾기 지도의 병원 · 약국 층 — 무엇을 언제 조회하나 (#1286 D3-1 · D5).
 *
 * **"켜기 전에는 요청이 절대 없다" 를 여기서 잠근다.** e2e 는 카카오 SDK 가 실패해 지도 보기가 곧장 목록으로
 * 옮겨지므로(#1289) 토글이 그려지지 않는다 — 판정 사슬(끔 → `null` → `enabled: false`)을 고리마다 본다.
 */
describe('facilityLayerPosition — 끄면 조회가 꺼진다', () => {
  it('끔이면 null 이다', () => {
    expect(facilityLayerPosition(false)).toBeNull()
  })

  it('켬이면 조회 기준점(제주시청)이다 — 지도 기준점이 아니다', () => {
    expect(facilityLayerPosition(true)).toEqual(JEJU_QUERY_CENTER)
    expect(FACILITY_LAYER_CENTER).toBe(JEJU_QUERY_CENTER)
  })

  it('켤 때마다 같은 참조다 — 조회 key 가 흔들리지 않는다', () => {
    expect(facilityLayerPosition(true)).toBe(facilityLayerPosition(true))
  })
})

describe('조회 범위 — 고정 중심 · 50km · 250', () => {
  it('반경은 백엔드 상한 50000 이다', () => {
    expect(FACILITY_LAYER_RADIUS).toBe(50_000)
  })

  it('경로가 radius=50000&size=250 이다 — type 등 좁히는 조건은 보내지 않는다', () => {
    const path = facilitiesPath({
      ...FACILITY_LAYER_CENTER,
      radius: FACILITY_LAYER_RADIUS,
      size: MAX_SIZE,
    })

    expect(path).toContain('lat=33.4996213&lng=126.5311884&radius=50000&size=250')
    expect(path).not.toContain('type=')
  })
})

describe('판정 사슬의 나머지 고리 — 소스', () => {
  it('useNearbyFacilities 는 기준점이 null 이면 조회하지 않는다', () => {
    expect(readSourceWithoutComments('src/features/emergency/use-nearby-facilities.ts')).toContain(
      'enabled: position !== null',
    )
  })

  it('useFacilityLayer 는 토글 값을 facilityLayerPosition 으로만 넘긴다', () => {
    const hook = readSourceWithoutComments('src/features/place/use-facility-layer.ts')

    expect(hook).toContain('useNearbyFacilities(facilityLayerPosition(on), FACILITY_LAYER_RADIUS)')
  })
})
