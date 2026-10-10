import { describe, expect, it } from 'vitest'

import { briefingDayFacts } from '@/lib/plan/briefing-day-facts'
import type { PlanDailyWeatherItem } from '@/types/plan'

function weather(overrides: Partial<PlanDailyWeatherItem> = {}): PlanDailyWeatherItem {
  return {
    date: '2026-09-19',
    forecastSourceCode: 'SHORT_TERM',
    forecastSourceName: '단기예보',
    minTemperature: 21,
    maxTemperature: 26,
    maxFeelsLikeTemperature: 27.5,
    maxPrecipitationProbability: 10,
    precipitationTypeName: '없음',
    skyStateName: '맑음',
    maxWindSpeed: 3.1,
    maxHumidity: 60,
    ...overrides,
  }
}

describe('briefingDayFacts — 응답에 있는 값만 세운다 (#733)', () => {
  it('하늘상태 · 최고 · 최저 · 강수확률을 이 순서로 고른다', () => {
    expect(briefingDayFacts(weather())).toEqual([
      { kind: 'sky', name: '맑음' },
      { kind: 'maxTemperature', value: 26 },
      { kind: 'minTemperature', value: 21 },
      { kind: 'precipitation', value: 10 },
    ])
  })

  /*
    **큰 숫자와 같은 값을 두 번 세우지 않는다.** 중기예보 구간은 체감온도가 없어
    `displayTemperature` 가 최고기온을 큰 숫자로 올린다 — 그 규칙은
    `supportingTemperatures` 가 갖고 여기서 다시 구현하지 않는다.
  */
  it('체감온도가 없는 날에는 최고기온이 큰 숫자로 가므로 지표 줄에서 빠진다', () => {
    const facts = briefingDayFacts(weather({ maxFeelsLikeTemperature: null }))

    expect(facts.map((fact) => fact.kind)).toEqual(['sky', 'minTemperature', 'precipitation'])
  })

  /** `0` 은 유효한 값이다 — falsy 로 거르면 강수 0% 인 날이 통째로 사라진다 */
  it('강수확률 0% 와 기온 0℃ 를 버리지 않는다', () => {
    const facts = briefingDayFacts(
      weather({ maxPrecipitationProbability: 0, minTemperature: 0, maxFeelsLikeTemperature: 3 }),
    )

    expect(facts).toContainEqual({ kind: 'precipitation', value: 0 })
    expect(facts).toContainEqual({ kind: 'minTemperature', value: 0 })
  })

  it('값이 하나도 없으면 빈 배열이다 — 호출부가 줄 자체를 내지 않는다', () => {
    const empty = weather({
      minTemperature: null,
      maxTemperature: null,
      maxFeelsLikeTemperature: null,
      maxPrecipitationProbability: null,
      skyStateName: null,
    })

    expect(briefingDayFacts(empty)).toEqual([])
    expect(briefingDayFacts(null)).toEqual([])
    expect(briefingDayFacts(undefined)).toEqual([])
  })

  /*
    **강수형태를 세우지 않는다.** 비가 없는 날 서버가 `없음` 을 주므로 그대로 세우면
    읽는 사람에게 아무 말도 하지 않는 칸이 된다.
  */
  it('precipitationTypeName 을 쓰지 않는다', () => {
    const facts = briefingDayFacts(weather({ precipitationTypeName: '비' }))

    expect(JSON.stringify(facts)).not.toContain('비')
  })
})
