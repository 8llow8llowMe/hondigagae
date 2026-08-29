import { describe, expect, it } from 'vitest'

import { pickTopPlaces, resolveBasisPlaceId, splitReasons } from '@/lib/insight/reasons'
import type { SuitabilityReasonItem } from '@/types/insight'

function reason(code: string, scoreDelta: number): SuitabilityReasonItem {
  return { code, name: code, description: `${code} 설명`, scoreDelta }
}

describe('splitReasons', () => {
  it('감점(음수)과 정보성(0)을 나눈다', () => {
    const { penalties, informational } = splitReasons([
      reason('HEAT_RISK', -27),
      reason('CONGESTION_UNKNOWN', 0),
      reason('PET_ALLOWED', -5),
    ])

    expect(penalties.map((r) => r.code)).toEqual(['HEAT_RISK', 'PET_ALLOWED'])
    expect(informational.map((r) => r.code)).toEqual(['CONGESTION_UNKNOWN'])
  })

  it('서버 순서를 유지한다 — 재정렬하지 않는다', () => {
    const { penalties } = splitReasons([reason('A', -5), reason('B', -27), reason('C', -1)])

    // 영향이 큰 순서로 정렬하면 B 가 앞에 온다. 그렇게 하지 않는다.
    expect(penalties.map((r) => r.code)).toEqual(['A', 'B', 'C'])
  })

  it('빈 배열을 넣으면 양쪽 다 빈 배열이다', () => {
    expect(splitReasons([])).toEqual({ penalties: [], informational: [] })
  })
})

describe('resolveBasisPlaceId', () => {
  it('최근 본 장소를 먼저 쓴다', () => {
    expect(resolveBasisPlaceId('111', '222')).toBe('111')
  })

  it('최근 본 장소가 없으면 일정 첫 장소로 떨어진다', () => {
    expect(resolveBasisPlaceId(null, '222')).toBe('222')
  })

  it('둘 다 없으면 null 이다 — 호출부가 판정 섹션을 렌더하지 않는다', () => {
    expect(resolveBasisPlaceId(null, null)).toBeNull()
  })

  it('빈 문자열을 값으로 취급하지 않는다', () => {
    expect(resolveBasisPlaceId('', '222')).toBe('222')
    expect(resolveBasisPlaceId('', '')).toBeNull()
  })
})

describe('pickTopPlaces', () => {
  it('상한을 넘으면 앞에서 잘라낸다', () => {
    expect(pickTopPlaces([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3])
  })

  it('상한 미만이면 전부 돌려준다', () => {
    expect(pickTopPlaces([1, 2], 3)).toEqual([1, 2])
  })

  it('순서를 바꾸지 않는다 — 적합도로 정렬한 것이 아니다', () => {
    expect(pickTopPlaces(['c', 'a', 'b'], 3)).toEqual(['c', 'a', 'b'])
  })

  it('빈 목록·상한 0 을 견딘다', () => {
    expect(pickTopPlaces([], 3)).toEqual([])
    expect(pickTopPlaces([1, 2], 0)).toEqual([])
  })
})
