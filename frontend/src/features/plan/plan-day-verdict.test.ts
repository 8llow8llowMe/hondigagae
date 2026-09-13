import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { messages } from '@/lib/messages'
import { planVerdict } from '@/test/fixtures/plan'
import type { PlanDailyWeatherItem, PlanDayWeatherItem } from '@/types/plan'

function weather(overrides: Partial<PlanDailyWeatherItem>): PlanDailyWeatherItem {
  if (planVerdict.weather === null) throw new Error('fixture 에 예보가 있어야 한다')
  return { ...planVerdict.weather, ...overrides }
}

function render(
  overrides: Partial<PlanDayWeatherItem> = {},
  extra: { dayHasItems?: boolean } = {},
) {
  return renderToStaticMarkup(
    createElement(PlanDayVerdict, {
      verdict: { ...planVerdict, ...overrides },
      petConditionApplied: true,
      basisPetName: null,
      failed: false,
      onRetry: () => undefined,
      dayHasItems: true,
      ...extra,
    }),
  )
}

describe('PlanDayVerdict — 판정 옆 큰 숫자 (#253)', () => {
  it('체감온도를 그 이름으로 보여 준다', () => {
    const html = render({ weather: weather({ maxFeelsLikeTemperature: 33.4 }) })

    expect(html).toContain('33.4')
    expect(html).toContain(messages.plan.verdictFeelsLikeLabel)
  })

  /*
    **최고기온과 나란히 세우지 않는다.** 둘 다 ℃ 라 숫자가 두 개 붙으면 어느 쪽이
    무엇인지 라벨을 읽어야 알 수 있고, "큰 숫자 하나" 라는 이 자리의 성격이 사라진다.
  */
  it('체감온도가 있으면 최고기온을 함께 세우지 않는다', () => {
    const html = render({
      weather: weather({ maxFeelsLikeTemperature: 33.4, maxTemperature: 26 }),
    })

    expect(html).not.toContain(messages.plan.verdictTemperatureLabel)
    expect(html).not.toContain('26.0')
  })

  /*
    중기예보 구간은 체감온도가 **언제나 null** 이다. 그 자리를 비우면 11일 예보의 뒤쪽
    날들이 통째로 숫자를 잃으므로 최고기온을 세우되 **이름을 바꿔 말하지 않는다.**
  */
  it('체감온도가 없으면 최고기온으로 바꿔 세우고 라벨도 바꾼다', () => {
    const html = render({
      weather: weather({ maxFeelsLikeTemperature: null, maxTemperature: 24 }),
    })

    expect(html).toContain('24.0')
    expect(html).toContain(messages.plan.verdictTemperatureLabel)
    expect(html).not.toContain(messages.plan.verdictFeelsLikeLabel)
  })

  it('예보가 없으면 숫자 자리를 비운다 — 판정 자체는 남는다', () => {
    const html = render({ weather: null })

    expect(html).not.toContain(messages.plan.verdictFeelsLikeLabel)
    expect(html).not.toContain(messages.plan.verdictTemperatureLabel)
    // 등급 배지는 그대로다 — 예보가 없다고 판정을 지우지 않는다
    expect(html).toContain(planVerdict.suitabilityLevel?.name ?? '')
  })
})

/**
 * 판정을 못 낸 날의 문구 — 사유 코드가 가른다 (#497).
 *
 * 문장은 서버 enum(`PlanDayWeatherUnavailableReason`)의 것을 그대로 둔다. 짧게 줄여 적으면
 * **화면이 실제로 받는 문장이 아닌 것으로 검증하게 된다.**
 */
const NO_PLACE_ITEM_SENTENCE =
  '이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.'
const PAST_DATE_SENTENCE =
  '이미 지난 날짜라 예보가 남아 있지 않습니다. 이 날의 날씨 판정은 확인할 수 없습니다.'
const BEYOND_RANGE_SENTENCE =
  '예보는 오늘부터 11일까지만 제공되어 이 날짜는 아직 판정할 수 없습니다.'
const LOOKUP_FAILED_SENTENCE = '날씨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.'

/** 판정을 못 낸 날의 공통 모양 — 점수도 등급도 없다 */
function unavailable(code: string | null, reason: string | null): Partial<PlanDayWeatherItem> {
  return {
    score: null,
    suitabilityLevel: null,
    unavailableReasonCode: code,
    unavailableReason: reason,
  }
}

describe('PlanDayVerdict — 판정 불가 사유마다 말이 다르다 (#497)', () => {
  /*
    빈 일차에서 같은 사실을 두 번 말하던 것이 이 이슈다. 아래 `이 날은 아직 담은 곳이
    없어요.` 가 이미 그 말을 하므로 판정 자리는 **입을 다문다.**
  */
  it('NO_PLACE_ITEM 이고 항목이 없으면 아무것도 그리지 않는다 — 빈 일차 안내가 이미 말한다', () => {
    const html = render(unavailable('NO_PLACE_ITEM', NO_PLACE_ITEM_SENTENCE), {
      dayHasItems: false,
    })

    expect(html).toBe('')
  })

  /*
    **산책 항목만 있는 날이 이 갈래다.** `WALK` 의 `targetId` 는 장소가 아니라 판정 기준이
    못 되므로 `NO_PLACE_ITEM` 인데, 항목은 있어 빈 일차 안내가 나지 않는다. 여기서까지
    감추면 판정이 왜 없는지 아무도 말하지 않는다.
  */
  it('NO_PLACE_ITEM 이어도 항목이 있으면 서버 문장을 남긴다 — 대신 말해 줄 안내가 없다', () => {
    const html = render(unavailable('NO_PLACE_ITEM', NO_PLACE_ITEM_SENTENCE), { dayHasItems: true })

    expect(html).toContain(NO_PLACE_ITEM_SENTENCE)
  })

  it('PAST_DATE 는 화면 말투로 바꿔 말하고 재시도를 권하지 않는다', () => {
    const html = render(unavailable('PAST_DATE', PAST_DATE_SENTENCE), { dayHasItems: false })

    expect(html).toContain(messages.plan.verdictPastDate)
    // 합쇼체 서버 문장이 그대로 새어 나오지 않는다 (`DESIGN.md` 문구 톤)
    expect(html).not.toContain(PAST_DATE_SENTENCE)
    expect(html).not.toContain('다시 시도')
  })

  /*
    **예보 범위(11일)는 서버 상수다** (`PlanDayWeatherUnavailableReason.FORECAST_HORIZON_DAYS`).
    화면이 같은 숫자를 베껴 두면 원천 커버리지가 바뀔 때 둘이 갈린다.
  */
  it('BEYOND_FORECAST_RANGE 는 서버 문장을 그대로 쓴다 — 예보 범위는 서버가 안다', () => {
    const html = render(unavailable('BEYOND_FORECAST_RANGE', BEYOND_RANGE_SENTENCE), {
      dayHasItems: true,
    })

    expect(html).toContain(BEYOND_RANGE_SENTENCE)
  })

  it('LOOKUP_FAILED 는 감추지 않는다 — 넷 중 이것만 장애다', () => {
    const html = render(unavailable('LOOKUP_FAILED', LOOKUP_FAILED_SENTENCE), {
      dayHasItems: false,
    })

    expect(html).toContain(LOOKUP_FAILED_SENTENCE)
  })

  /*
    서버가 사유를 늘려도 화면이 말을 잃지 않아야 한다. 코드를 union 으로 좁히지 않고
    `string` 으로 둔 이유이기도 하다.
  */
  it('모르는 코드는 서버 문장으로 물러선다', () => {
    const html = render(unavailable('SOMETHING_NEW', '새로 생긴 사유입니다.'), {
      dayHasItems: true,
    })

    expect(html).toContain('새로 생긴 사유입니다.')
  })

  it('사유가 통째로 비면 자리를 만들지 않는다 — 빈 여백만 남는다', () => {
    const html = render(unavailable(null, null), { dayHasItems: true })

    expect(html).toBe('')
  })
})
