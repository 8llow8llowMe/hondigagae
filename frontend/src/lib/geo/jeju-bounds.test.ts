import { describe, expect, it } from 'vitest'

import { JEJU_CENTER } from '@/lib/geo/coord'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'
import { isInJeju, JEJU_BOUNDS } from '@/lib/geo/jeju-bounds'

describe('isInJeju — 제주 안', () => {
  /* 두 기준 좌표가 상자 밖이면 폴백이 스스로를 "제주 밖" 이라고 부르게 된다 */
  it('두 제주 기준 좌표는 안이다', () => {
    expect(isInJeju(JEJU_CENTER)).toBe(true)
    expect(isInJeju(JEJU_QUERY_CENTER)).toBe(true)
  })

  it.each([
    ['제주시청', 33.4996, 126.5312],
    ['서귀포시청', 33.2541, 126.5601],
    ['한라산 백록담', 33.3617, 126.5292],
    ['우도', 33.5064, 126.9531],
    ['마라도 (최남단)', 33.1069, 126.2675],
    ['추자도 (최북단 · 행정상 제주시)', 34.0577, 126.3241],
  ])('%s 는 안이다', (_name, lat, lng) => {
    expect(isInJeju({ lat, lng })).toBe(true)
  })
})

describe('isInJeju — 제주 밖', () => {
  /*
    dev 실측: 서울시청 좌표로 `/emergencies/facilities` 를 부르면 오류가 아니라
    200 + `facilities: []` 다. 조용한 0건이라 화면이 고장으로 보인다.
  */
  it.each([
    ['서울시청', 37.5665, 126.978],
    ['부산시청', 35.1796, 129.0756],
    ['목포', 34.7936, 126.3886],
    ['완도 (본토 최근접)', 34.3111, 126.755],
    ['진도', 34.4867, 126.2635],
    ['도쿄', 35.6762, 139.6503],
    ['적도 · 본초자오선 (좌표 미상 0,0)', 0, 0],
  ])('%s 는 밖이다', (_name, lat, lng) => {
    expect(isInJeju({ lat, lng })).toBe(false)
  })

  /*
    **`maxLat` 을 키우면 본토가 들어온다.** 추자도(34.058)를 담으면서 완도(34.311)를
    배제하는 값은 그 사이에만 있다 — 이 테스트가 그 여유를 지킨다.
  */
  it('추자도와 완도 사이에 상한이 있다', () => {
    expect(JEJU_BOUNDS.maxLat).toBeGreaterThan(34.058)
    expect(JEJU_BOUNDS.maxLat).toBeLessThan(34.311)
  })

  it('숫자가 아닌 좌표를 안이라고 하지 않는다', () => {
    expect(isInJeju({ lat: Number.NaN, lng: 126.5 })).toBe(false)
    expect(isInJeju({ lat: 33.5, lng: Number.POSITIVE_INFINITY })).toBe(false)
  })
})
