import { describe, expect, it } from 'vitest'

import { displayTemperature } from '@/lib/insight/temperature'
import { planVerdict } from '@/test/fixtures/plan'
import type { PlanDailyWeatherItem } from '@/types/plan'

/** 판정 fixture 의 예보를 바탕으로 필요한 필드만 바꾼다 */
function weather(overrides: Partial<PlanDailyWeatherItem>): PlanDailyWeatherItem {
  if (planVerdict.weather === null) throw new Error('fixture 에 예보가 있어야 한다')
  return { ...planVerdict.weather, ...overrides }
}

describe('displayTemperature — 체감온도가 먼저다 (#253)', () => {
  /*
    반려견은 헐떡임으로 체온을 내려 습도에 사람보다 민감하다. 기온과 상대습도를 합친
    열지수가 이 판정의 핵심 지표이고, 아트보드가 판정 옆에 둔 큰 숫자도 이 값이다.
  */
  it('체감온도가 있으면 그것을 세운다', () => {
    const result = displayTemperature(weather({ maxFeelsLikeTemperature: 33.4 }))

    expect(result).toEqual({ kind: 'feelsLike', value: 33.4 })
  })

  /*
    **최고기온을 체감온도라고 부르지 않는다.** 중기예보 구간은 시각별 데이터가 없어
    체감온도가 언제나 null 이고 서버도 최고기온으로 대신 채우지 않는다 — 화면이 대신
    채우면 판정의 근거를 잘못 알려 주는 것이라 `kind` 를 갈라 라벨까지 바꾼다.
  */
  it('체감온도가 없으면 최고기온을 세우되 종류를 갈라 준다', () => {
    const result = displayTemperature(
      weather({ maxFeelsLikeTemperature: null, maxTemperature: 24 }),
    )

    expect(result).toEqual({ kind: 'max', value: 24 })
  })

  it('둘 다 없으면 세울 것이 없다', () => {
    expect(
      displayTemperature(weather({ maxFeelsLikeTemperature: null, maxTemperature: null })),
    ).toBeNull()
  })

  /** 판정을 못 낸 날은 `weather` 자체가 null 이다 */
  it('예보가 통째로 없어도 죽지 않는다', () => {
    expect(displayTemperature(null)).toBeNull()
    expect(displayTemperature(undefined)).toBeNull()
  })

  /*
    **0℃ 를 빠뜨리지 않는다.** `??` 나 truthy 검사로 고르면 영하로 내려간 날의 0.0 이
    "값이 없다" 로 접혀 최고기온이 대신 선다.
  */
  it('0 도 값이다', () => {
    expect(displayTemperature(weather({ maxFeelsLikeTemperature: 0 }))).toEqual({
      kind: 'feelsLike',
      value: 0,
    })
  })
})
