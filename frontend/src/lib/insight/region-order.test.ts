import { describe, expect, it } from 'vitest'

import { sortRegionsByScore } from '@/lib/insight/region-order'
import type { RegionWeatherItem } from '@/types/insight'

/** 이 함수가 보는 것은 `weatherScore` 뿐이다 — 나머지 필드는 순서에 들어가지 않는다 */
function region(code: string, weatherScore: number | null): RegionWeatherItem {
  return {
    region: { code, name: code, description: null },
    weatherScore,
  } as RegionWeatherItem
}

const codes = (items: RegionWeatherItem[]) => items.map((item) => item.region.code)

describe('sortRegionsByScore', () => {
  /*
    dev 실측(2026-09-08). 서버는 지리 순서로 주고, 추천 권역인 한라산(100)이 맨 끝이었다 —
    바로 위 문장이 "오늘은 한라산권이 가장 나아요" 라고 말하는데도 그랬다.
  */
  const OBSERVED = [
    region('NORTH', 85),
    region('SOUTH', 85),
    region('EAST', 85),
    region('WEST', 85),
    region('HALLA', 100),
  ]

  it('점수 높은 권역이 맨 앞에 온다', () => {
    expect(codes(sortRegionsByScore(OBSERVED))[0]).toBe('HALLA')
  })

  /*
    동점 구간이 흔들리면 매일 같은 자리를 보던 사용자가 목록을 다시 읽어야 한다.
    안정 정렬이라 85 넷은 서버가 준 지리 순서 그대로 남는다.
  */
  it('동점은 서버 순서를 지킨다', () => {
    expect(codes(sortRegionsByScore(OBSERVED))).toEqual(['HALLA', 'NORTH', 'SOUTH', 'EAST', 'WEST'])
  })

  /* `null` 은 "예보를 못 받았다" 지 0점이 아니다. 최하위로 섞으면 가장 나쁜 곳으로 읽힌다 */
  it('예보 없는 권역은 맨 뒤로 보내되 0점 취급하지 않는다', () => {
    const sorted = sortRegionsByScore([region('A', null), region('B', 40), region('C', 90)])

    expect(codes(sorted)).toEqual(['C', 'B', 'A'])
  })

  it('전부 예보가 없으면 서버 순서를 그대로 둔다', () => {
    const sorted = sortRegionsByScore([region('A', null), region('B', null)])

    expect(codes(sorted)).toEqual(['A', 'B'])
  })

  /* 쿼리 캐시가 들고 있는 배열이라 제자리 정렬하면 캐시된 응답이 바뀐다 */
  it('입력 배열을 변형하지 않는다', () => {
    const input = [region('A', 10), region('B', 90)]
    sortRegionsByScore(input)

    expect(codes(input)).toEqual(['A', 'B'])
  })

  it('빈 목록을 견딘다', () => {
    expect(sortRegionsByScore([])).toEqual([])
  })
})
