import { describe, expect, it } from 'vitest'

import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'
import { isInJeju } from '@/lib/geo/jeju-bounds'
import { JEJU_REGION_CENTERS, JEJU_REGION_CODES } from '@/lib/geo/jeju-regions'

describe('JEJU_REGION_CENTERS — 권역 대표 좌표 (#639)', () => {
  it('4권역이다 — 한라산권은 없다 (세부명세 D8-3: 거기엔 병원이 없다)', () => {
    expect(JEJU_REGION_CODES).toEqual(['JEJU_CITY', 'SEOGWIPO', 'EAST', 'WEST'])
  })

  /*
    **제주시는 `JEJU_QUERY_CENTER` 를 재사용한다.** 같은 자리를 두 번 적으면 한쪽만 고쳐져
    "제주 중심 폴백" 과 "제주시 권역" 이 조용히 다른 곳을 조회한다. 참조가 같으면
    갈릴 수 없다.
  */
  it('제주시는 JEJU_QUERY_CENTER 와 같은 객체다 — 값을 새로 적지 않는다', () => {
    expect(JEJU_REGION_CENTERS.JEJU_CITY).toBe(JEJU_QUERY_CENTER)
  })

  it('네 좌표가 모두 제주 안이다 — 밖이면 조용한 0건이 온다', () => {
    for (const code of JEJU_REGION_CODES) {
      expect(isInJeju(JEJU_REGION_CENTERS[code])).toBe(true)
    }
  })

  it('네 자리가 서로 다르다 — 같으면 세그먼트가 같은 결과를 네 번 보여준다', () => {
    const keys = JEJU_REGION_CODES.map((code) => {
      const point = JEJU_REGION_CENTERS[code]
      return `${point.lat},${point.lng}`
    })

    expect(new Set(keys).size).toBe(JEJU_REGION_CODES.length)
  })

  /* 남북·동서가 실제로 갈려야 "동부" 를 골랐을 때 동쪽이 나온다 */
  it('서귀포가 제주시보다 남쪽이고, 동부가 서부보다 동쪽이다', () => {
    expect(JEJU_REGION_CENTERS.SEOGWIPO.lat).toBeLessThan(JEJU_REGION_CENTERS.JEJU_CITY.lat)
    expect(JEJU_REGION_CENTERS.EAST.lng).toBeGreaterThan(JEJU_REGION_CENTERS.WEST.lng)
  })
})
