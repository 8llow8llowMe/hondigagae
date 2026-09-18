import { displayTemperature, supportingTemperatures } from '@/lib/insight/temperature'
import type { PlanDailyWeatherItem } from '@/types/plan'

/**
 * 브리핑 날씨 카드의 **하루 지표 줄** (#733).
 *
 * ## 왜 시간축이 아닌가
 *
 * 이슈는 하루를 아침·낮·저녁으로 갈라 시간축을 세우기를 요구했지만, **브리핑 응답에
 * 시간대별 값이 없다.** `PlanDailyWeatherItem` 은 전부 하루치 집계(`min`/`max`/`maxXxx`)고,
 * 시각별 곡선은 `walkTimes` 안의 좌표로 tour 를 따로 불러야 나온다 — 그런데 **전날 갈래는
 * `walkTimes` 자체가 null** 이라(서버가 당일에만 채운다) 부를 좌표조차 없다.
 *
 * 최저기온을 `아침`, 최고기온을 `낮` 으로 옮겨 적으면 구간이 세 개인 화면은 만들 수 있다.
 * 하지만 그 시각은 응답이 말한 적이 없는 값이라 **화면이 지어내는 사실**이 된다. 그래서
 * 시간을 말하지 않고, **응답이 실제로 들고 있으면서 화면이 버리고 있던 값**만 세운다.
 * 시간대별 값은 BE 후속 요청이다.
 *
 * ## 무엇을 고르는가
 *
 * | 순서 | 값 | 근거 |
 * |---|---|---|
 * | 1 | `skyStateName` | 서버가 이미 표시용 이름으로 낮춰 준다 (`맑음`) |
 * | 2 | 최고기온 | 큰 숫자가 이미 최고기온이면 빠진다 |
 * | 3 | 최저기온 | 하루의 **폭**이 나갈 시각을 가른다 (#352 와 같은 근거) |
 * | 4 | `maxPrecipitationProbability` | 우산을 챙길지 |
 *
 * **온도 두 값은 `supportingTemperatures` 가 고른다.** 큰 숫자(`displayTemperature`)가
 * 무엇을 집었는지가 여기서 무엇이 빠지는지를 정한다 — 규칙을 다시 구현하면 중기예보 날에
 * 같은 값이 한 자리에 두 번 선다.
 *
 * **`precipitationTypeName` 은 넣지 않는다.** 비가 없는 날 서버가 `없음` 을 주므로
 * (`강수 형태 없음`) 그대로 세우면 읽는 사람에게 아무 말도 하지 않는 칸이 된다.
 *
 * **풍속·습도도 넣지 않는다.** 375px 한 줄에 다섯 칸이 넘어가면 줄이 접히면서 지표
 * 줄이라기보다 표가 된다 — 판단을 가르는 넷만 남긴다.
 *
 * `0` 은 유효한 값이라 falsy 로 거르지 않는다 (강수확률 0% · 기온 0℃).
 */
export type BriefingDayFact =
  | { kind: 'sky'; name: string }
  | { kind: 'maxTemperature' | 'minTemperature' | 'precipitation'; value: number }

/** 값이 하나도 없으면 빈 배열이다 — 호출부가 줄 자체를 내지 않는다 */
export function briefingDayFacts(
  weather: PlanDailyWeatherItem | null | undefined,
): BriefingDayFact[] {
  if (weather === null || weather === undefined) return []

  const facts: BriefingDayFact[] = []

  if (weather.skyStateName !== null) facts.push({ kind: 'sky', name: weather.skyStateName })

  for (const temperature of supportingTemperatures(weather, displayTemperature(weather))) {
    facts.push({
      kind: temperature.kind === 'max' ? 'maxTemperature' : 'minTemperature',
      value: temperature.value,
    })
  }

  if (typeof weather.maxPrecipitationProbability === 'number') {
    facts.push({ kind: 'precipitation', value: weather.maxPrecipitationProbability })
  }

  return facts
}
