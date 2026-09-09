import { describe, expect, it } from 'vitest'

import { displayTemperature, supportingTemperatures } from '@/lib/insight/temperature'
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
  const timeBased = [messages.place.detailFeelsLike, messages.home.feelsLikeLabel]
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

/*
  **#352.** 큰 숫자 하나만으로는 하루의 폭을 알 수 없다 — `최고 체감온도 33.4℃` 가
  아침에 나갈 수 있는 날인지 말해 주지 않는다. 받치는 줄이 그 폭을 말한다.

  이 함수의 값어치는 **큰 숫자를 되풀이하지 않는 것**이다. 중기예보 구간은 체감온도가
  없어 큰 숫자가 최고기온이므로, 그때 최고기온을 다시 세우면 같은 값이 두 번 선다.
*/
describe('supportingTemperatures — 큰 숫자를 받치는 줄 (#352)', () => {
  it('체감온도가 큰 숫자면 최고·최저기온을 그 순서로 받친다', () => {
    const weather = { maxFeelsLikeTemperature: 33.4, maxTemperature: 31, minTemperature: 24 }

    expect(supportingTemperatures(weather, displayTemperature(weather))).toEqual([
      { kind: 'max', value: 31 },
      { kind: 'min', value: 24 },
    ])
  })

  /* 중기예보 구간 — 큰 숫자가 이미 최고기온이라 그것을 빼고 최저만 남긴다 */
  it('큰 숫자가 최고기온이면 최고를 되풀이하지 않는다', () => {
    const weather = { maxFeelsLikeTemperature: null, maxTemperature: 31, minTemperature: 24 }
    const displayed = displayTemperature(weather)

    expect(displayed).toEqual({ kind: 'max', value: 31 })
    expect(supportingTemperatures(weather, displayed)).toEqual([{ kind: 'min', value: 24 }])
  })

  it('최저기온만 있으면 그 한 줄만 낸다', () => {
    const weather = { maxFeelsLikeTemperature: null, maxTemperature: null, minTemperature: 24 }

    expect(supportingTemperatures(weather, displayTemperature(weather))).toEqual([
      { kind: 'min', value: 24 },
    ])
  })

  it('둘 다 없으면 빈 배열이다 — 호출부가 줄 자체를 내지 않는다', () => {
    const weather = { maxFeelsLikeTemperature: 33.4, maxTemperature: null, minTemperature: null }

    expect(supportingTemperatures(weather, displayTemperature(weather))).toEqual([])
  })

  it('weather 가 null 이거나 undefined 면 빈 배열이다', () => {
    expect(supportingTemperatures(null, null)).toEqual([])
    expect(supportingTemperatures(undefined, null)).toEqual([])
  })

  /*
    **0℃ 는 유효한 온도다.** falsy 검사로 걸러 두면 제주 한겨울 최저기온이 통째로
    사라진다 — 한라산권은 실제로 영하로 내려간다.
  */
  it('0℃ 와 영하를 값으로 남긴다 — falsy 로 걸러내지 않는다', () => {
    const weather = { maxFeelsLikeTemperature: 3.2, maxTemperature: 0, minTemperature: -4.5 }

    expect(supportingTemperatures(weather, displayTemperature(weather))).toEqual([
      { kind: 'max', value: 0 },
      { kind: 'min', value: -4.5 },
    ])
  })
})
