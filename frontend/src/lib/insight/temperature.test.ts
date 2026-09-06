import { describe, expect, it } from 'vitest'

import { displayTemperature } from '@/lib/insight/temperature'
import { messages } from '@/lib/messages'
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

/*
  #259. 열지수는 두 기준으로 온다 — 적합도·일정 판정은 **하루 최대**
  (`maxFeelsLikeTemperature`), 산책 위험도와 홈은 **그 시각**(`heatIndexCelsius`)이다.
  장소 상세 좌측 레일에서는 둘이 나란히 선다.

  **이름을 나누지 않고 기준을 나눈다.** 같은 물리량이라 이름이 갈리면 사용자는 서로 다른
  값으로 읽는다 — 예전에 홈만 `체감 열지수` 였던 것이 그 상태다. 가르는 일은 `최고` 가 한다.

  `displayTemperature` 옆에 두는 이유: 이 규칙이 깨지는 방식은 **화면 하나만 고치는 것**인데,
  그것을 잡으려면 네 문구를 한자리에서 봐야 한다.
*/
describe('체감온도 라벨 — 이름은 하나, 기준은 `최고` 가 가른다 (#259)', () => {
  const timeBased = [messages.place.detailHeatIndex, messages.home.heatIndexLabel]
  const dayMax = [messages.place.detailFeelsLikeTemperature, messages.plan.verdictFeelsLikeLabel]

  it('시각 기준은 화면이 달라도 같은 이름이다', () => {
    expect(new Set(timeBased).size).toBe(1)
  })

  it('하루 최대도 화면이 달라도 같은 이름이다', () => {
    expect(new Set(dayMax).size).toBe(1)
  })

  it('하루 최대는 시각 기준 이름에 `최고` 를 얹은 것이다', () => {
    for (const label of dayMax) {
      expect(label).toBe(`최고 ${timeBased[0]}`)
    }
  })

  /*
    중기예보 구간의 폴백. **최고기온을 체감온도라고 부르지 않는다** — 판정의 근거를 잘못
    알려 주는 것이다 (#253). 두 라벨이 같아지면 그 구분이 사라진다.
  */
  it('최고기온 폴백은 체감온도와 다른 이름을 유지한다', () => {
    expect(messages.place.detailMaxTemperature).not.toBe(messages.place.detailFeelsLikeTemperature)
    expect(messages.plan.verdictTemperatureLabel).not.toBe(messages.plan.verdictFeelsLikeLabel)
  })
})
