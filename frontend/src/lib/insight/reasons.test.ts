import { describe, expect, it } from 'vitest'

import {
  appliedFactorsOf,
  pickTopPlaces,
  resolveBasisPlaceId,
  splitReasons,
} from '@/lib/insight/reasons'
import type { PlaceSuitabilityResponse, SuitabilityReasonItem } from '@/types/insight'

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

describe('appliedFactorsOf', () => {
  /** 이 함수가 보는 것은 두 불린뿐이다 — 나머지 필드는 판정에 들어가지 않는다 */
  function applied(weather: boolean, congestion: boolean): PlaceSuitabilityResponse {
    return {
      weatherApplied: weather,
      congestionApplied: congestion,
    } as PlaceSuitabilityResponse
  }

  it('둘 다 반영됐으면 둘 다 말한다', () => {
    expect(appliedFactorsOf([applied(true, true)])).toBe('weatherCongestion')
  })

  /*
    이 이슈의 제보 자리다 — 캡션은 "오늘 날씨와 혼잡도 반영" 이라고 적혀 있는데
    그 아래 장소 세 장이 전부 `혼잡도 정보 없음` 배지를 달고 있었다.
  */
  it('혼잡도 데이터가 어디에도 없으면 날씨만 말한다', () => {
    expect(appliedFactorsOf([applied(true, false), applied(true, false)])).toBe('weather')
  })

  it('날씨만 없을 수도 있다', () => {
    expect(appliedFactorsOf([applied(false, true)])).toBe('congestion')
  })

  /*
    `every` 가 아니라 `some` 이다. 한 장에만 붙어도 그 장의 점수에는 실제로 반영됐다 —
    전부에 붙어야 말할 수 있다고 하면 이번에는 반영된 것을 안 반영했다고 말하게 된다.
  */
  it('한 장에만 붙어 있어도 반영됐다고 말한다', () => {
    expect(appliedFactorsOf([applied(true, false), applied(true, true)])).toBe('weatherCongestion')
  })

  it('둘 다 없으면 none — 캡션 자체를 그리지 않는다', () => {
    expect(appliedFactorsOf([applied(false, false)])).toBe('none')
  })

  it('조회 전(빈 배열)에도 none 이다 — 로딩 중 문구가 바뀌었다 되돌아가지 않는다', () => {
    expect(appliedFactorsOf([])).toBe('none')
  })
})
