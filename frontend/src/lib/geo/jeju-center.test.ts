import { describe, expect, it } from 'vitest'

import { JEJU_CENTER, JEJU_MAP_LEVEL } from '@/lib/geo/coord'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'

/**
 * 같은 이름의 상수 둘이 다른 값을 갖고 있었고, 지도(#14)가 그중 하나를 잘못 집어
 * 첫 화면이 비었다. 이름과 쓰임이 갈렸다는 것을 테스트로 고정한다.
 */
describe('제주 기준 좌표 두 개', () => {
  it('둘은 다른 지점이다 — 같은 값이 되면 이름을 나눈 이유가 사라진다', () => {
    expect(JEJU_QUERY_CENTER.lat).not.toBe(JEJU_CENTER.lat)
  })

  it('둘 다 제주 안이다 — 위도 33 / 경도 126', () => {
    for (const point of [JEJU_CENTER, JEJU_QUERY_CENTER]) {
      expect(point.lat).toBeGreaterThan(33)
      expect(point.lat).toBeLessThan(34)
      expect(point.lng).toBeGreaterThan(126)
      expect(point.lng).toBeLessThan(127)
    }
  })

  it('조회 기준점이 지도 중심보다 북쪽이다 — 사람이 사는 쪽(제주시)이다', () => {
    expect(JEJU_QUERY_CENTER.lat).toBeGreaterThan(JEJU_CENTER.lat)
  })

  it('첫 확대 단계는 섬 전체가 담기는 값이다 — 7 이면 한라산만 보인다', () => {
    expect(JEJU_MAP_LEVEL).toBeGreaterThanOrEqual(9)
  })
})
