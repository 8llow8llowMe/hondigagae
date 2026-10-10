import { describe, expect, it } from 'vitest'

import { findTiedTop } from '@/lib/insight/region-tie'
import type { CodeNameMetadata } from '@/types/api'
import type { RegionWeatherItem } from '@/types/insight'

/** 이 함수가 보는 것은 `weatherScore` 뿐이다 — 나머지 필드는 판정에 들어가지 않는다 */
function region(code: string, weatherScore: number | null): RegionWeatherItem {
  return {
    region: { code, name: `${code}권`, description: null },
    weatherScore,
  } as RegionWeatherItem
}

function meta(code: string): CodeNameMetadata {
  return { code, name: `${code}권`, description: null }
}

const codes = (items: RegionWeatherItem[]) => items.map((item) => item.region.code)

describe('findTiedTop', () => {
  /*
    2026-09-15 실측. 다섯 배지가 전부 `100` 인데 헤드라인은 "오늘은 제주시권이 가장
    나아요" 라고 1위를 단정하고 있었다 — 화면이 같은 숫자를 보여 주면서 한 곳을 고르면
    사용자는 자기가 표를 잘못 읽었다고 생각한다.
  */
  it('전부 같은 점수면 모두 동점이고 점수 있는 권역 전부다', () => {
    const result = findTiedTop(
      [
        region('NORTH', 100),
        region('SOUTH', 100),
        region('EAST', 100),
        region('WEST', 100),
        region('HALLA', 100),
      ],
      meta('NORTH'),
    )

    expect(result.regions).toHaveLength(5)
    expect(result.isAll).toBe(true)
  })

  /*
    `null` 은 예보를 못 받았다는 뜻이지 0점이 아니다 (`sortRegionsByScore` 와 같은 규칙).
    셈에서 빼야 "어느 권역이든" 이 예보 없는 권역까지 포함하는 거짓말이 되지 않는다.
  */
  it('점수가 없는 권역은 동점 셈에서 뺀다', () => {
    const result = findTiedTop(
      [
        region('NORTH', 100),
        region('SOUTH', 100),
        region('EAST', 90),
        region('HALLA', null),
        region('WEST', 80),
      ],
      meta('NORTH'),
    )

    expect(codes(result.regions)).toEqual(['NORTH', 'SOUTH'])
    expect(result.isAll).toBe(false)
  })

  it('단독 1위면 한 곳만 남는다', () => {
    const result = findTiedTop([region('A', 90), region('B', 80), region('C', 70)], meta('A'))

    expect(codes(result.regions)).toEqual(['A'])
    expect(result.isAll).toBe(false)
  })

  it('전부 예보가 없으면 동점도 없다', () => {
    const result = findTiedTop([region('A', null), region('B', null)], meta('A'))

    expect(result.regions).toEqual([])
    expect(result.isAll).toBe(false)
  })

  it('빈 목록을 견딘다', () => {
    const result = findTiedTop([], null)

    expect(result.regions).toEqual([])
    expect(result.isAll).toBe(false)
  })

  /*
    **서버의 선택을 지우지 않고 앞세운다.** 동점이라는 사실은 화면이 말해야 하지만,
    서버가 그중 하나를 고른 것까지 무를 이유는 없다 — 문장 첫 자리가 그 권역이다.
  */
  it('서버 추천 권역이 동점 집합에 있으면 첫 자리에 선다', () => {
    const result = findTiedTop(
      [region('NORTH', 100), region('SOUTH', 100), region('EAST', 100)],
      meta('EAST'),
    )

    expect(codes(result.regions)).toEqual(['EAST', 'NORTH', 'SOUTH'])
  })

  /* 앞세우는 것 말고는 서버가 준 순서를 흔들지 않는다 */
  it('추천 권역을 앞세워도 나머지 순서는 서버 순서 그대로다', () => {
    const result = findTiedTop(
      [region('NORTH', 100), region('SOUTH', 100), region('EAST', 100), region('WEST', 100)],
      meta('WEST'),
    )

    expect(codes(result.regions)).toEqual(['WEST', 'NORTH', 'SOUTH', 'EAST'])
  })

  /*
    서버가 최고점이 아닌 권역을 고르는 날이 있을 수 있다 (혼잡·특보처럼 점수 밖의 축).
    그때 그 권역을 동점 목록에 끼워 넣으면 화면이 바로 아래 표와 다른 말을 한다.
  */
  it('추천 권역이 최고점이 아니면 동점 목록에 끼워 넣지 않는다', () => {
    const result = findTiedTop(
      [region('NORTH', 100), region('SOUTH', 100), region('EAST', 60)],
      meta('EAST'),
    )

    expect(codes(result.regions)).toEqual(['NORTH', 'SOUTH'])
  })

  /* 입력은 쿼리 캐시가 들고 있는 배열이라 제자리로 건드리면 캐시된 응답이 바뀐다 */
  it('입력 배열을 변형하지 않는다', () => {
    const input = [region('A', 100), region('B', 100)]
    findTiedTop(input, meta('B'))

    expect(codes(input)).toEqual(['A', 'B'])
  })
})
