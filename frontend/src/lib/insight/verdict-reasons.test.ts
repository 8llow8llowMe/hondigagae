import { describe, expect, it } from 'vitest'

import { withoutWarningReason } from '@/lib/insight/verdict-reasons'
import type { WalkSafetyReasonItem, WeatherWarningItem } from '@/types/insight'

function reason(code: string, description = `${code} 설명`): WalkSafetyReasonItem {
  return { code, name: code, description }
}

const WARNING = {} as WeatherWarningItem

/*
  #1065. 홈은 최상단 `WeatherWarningStrip` 이 배지로 특보의 **종류까지** 말하고 판정 카드가
  바로 아래라, 판정 근거의 `WEATHER_WARNING_ACTIVE` 줄이 같은 사실을 한눈에 두 번 말했다.
  서버 문장은 고치지 않고 홈에서 **표시만** 거른다 (DESIGN.md §1 "기상특보는 화면당 1회").
*/
describe('withoutWarningReason', () => {
  it('특보가 있으면 특보 근거 줄만 뺀다', () => {
    const reasons = [
      reason('WEATHER_WARNING_ACTIVE', '폭염 경보 발효 중입니다. 더위가 심합니다.'),
      reason('PAVEMENT_HOT'),
      reason('HEAT_SENSITIVE'),
    ]

    expect(withoutWarningReason(reasons, WARNING).map((r) => r.code)).toEqual([
      'PAVEMENT_HOT',
      'HEAT_SENSITIVE',
    ])
  })

  it('서버 순서를 지킨다 — 특보 줄이 가운데 있어도 나머지 순서는 그대로다', () => {
    const reasons = [reason('A'), reason('WEATHER_WARNING_ACTIVE'), reason('B')]

    expect(withoutWarningReason(reasons, WARNING).map((r) => r.code)).toEqual(['A', 'B'])
  })

  /*
    **스트립이 비는 날에는 걸러내지 않는다.** 걸러낼 근거는 "위 띠가 이미 말한다" 하나인데,
    같은 응답의 `weatherWarning` 이 없으면 그 전제가 서지 않는다 — 그때 줄을 지우면 특보가
    화면 어디에도 없다. 틀릴 때 정보를 숨기는 쪽보다 한 번 더 말하는 쪽으로 틀린다.
  */
  it('특보가 없으면 근거를 건드리지 않는다', () => {
    const reasons = [reason('WEATHER_WARNING_ACTIVE'), reason('PAVEMENT_HOT')]

    expect(withoutWarningReason(reasons, null)).toEqual(reasons)
  })

  it('입력 배열을 바꾸지 않는다', () => {
    const reasons = [reason('WEATHER_WARNING_ACTIVE'), reason('PAVEMENT_HOT')]

    withoutWarningReason(reasons, WARNING)

    expect(reasons).toHaveLength(2)
  })
})
