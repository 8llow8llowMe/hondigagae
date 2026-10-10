import { describe, expect, it } from 'vitest'

import { pickWeatherWarning } from '@/lib/insight/weather-warning'
import type { WeatherWarningItem } from '@/types/insight'

function warning(typeCode: string, levelCode: string): WeatherWarningItem {
  return {
    type: { code: typeCode, name: typeCode, description: null },
    level: { code: levelCode, name: levelCode, description: null },
  } as WeatherWarningItem
}

const HEAT = warning('HEAT_WAVE', 'WARNING')
const RAIN = warning('HEAVY_RAIN', 'ADVISORY')

describe('pickWeatherWarning', () => {
  it('처음 잡히는 특보를 쓴다', () => {
    expect(pickWeatherWarning([HEAT, RAIN])).toBe(HEAT)
  })

  /*
    폴백이 있는 이유는 값이 갈려서가 아니라 **응답이 없을 수 있어서**다. 권역 조회가
    실패하면 그 섹션은 통째로 숨는데(공통명세 S4-1 최소 골격), 그때도 특보는 말해야 한다.
  */
  it('앞이 비면 뒤에서 집는다', () => {
    expect(pickWeatherWarning([null, undefined, RAIN])).toBe(RAIN)
  })

  it('아직 로딩 중인 undefined 를 특보 없음으로 확정하지 않는다', () => {
    expect(pickWeatherWarning([undefined, HEAT])).toBe(HEAT)
  })

  /*
    **특보가 없는 날이 압도적으로 흔하다** (`WeatherWarningProcessor` 주석). 그 날
    `null` 을 돌려주면 스트립이 렌더되지 않는다.
  */
  it('전부 비면 null 이다', () => {
    expect(pickWeatherWarning([null, null, undefined])).toBeNull()
  })

  it('후보가 없어도 터지지 않는다', () => {
    expect(pickWeatherWarning([])).toBeNull()
  })
})
