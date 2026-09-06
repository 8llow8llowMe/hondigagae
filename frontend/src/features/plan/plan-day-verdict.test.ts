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

function render(overrides: Partial<PlanDayWeatherItem> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayVerdict, {
      verdict: { ...planVerdict, ...overrides },
      petConditionApplied: true,
      basisPetName: null,
      failed: false,
      onRetry: () => undefined,
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
