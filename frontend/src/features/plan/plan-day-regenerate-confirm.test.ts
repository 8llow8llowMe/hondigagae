import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayRegenerateConfirm } from '@/features/plan/plan-day-regenerate-confirm'
import { messages } from '@/lib/messages'

function render(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayRegenerateConfirm, {
      onApply: () => undefined,
      applying: false,
      error: null,
      hasStartTime: false,
      ...overrides,
    }),
  )
}

describe('PlanDayRegenerateConfirm', () => {
  /*
    R5. 계약에 일자 이력이 없어 undo 를 만들 수 없다. **확정 전에 사실을 말하는 것**이
    유일한 방어다.
  */
  it('되돌릴 수 없다는 것과 다녀옴 초기화를 함께 말한다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.regenerateDayIrreversible)
    expect(markup).toContain(messages.plan.regenerateDayVisitReset)
  })

  it('두 경고가 확정 버튼보다 앞에 온다', () => {
    const markup = render()

    expect(markup.indexOf(messages.plan.regenerateDayIrreversible)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
    expect(markup.indexOf(messages.plan.regenerateDayVisitReset)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
  })

  it('저장 실패 문구를 낸다', () => {
    expect(render({ error: { message: '사라진 장소가 있어요.', retriable: false } })).toContain(
      '사라진 장소가 있어요.',
    )
  })

  /*
    #451. 액션이라 카드가 아니고 L0 바닥 위에 선다 — 위 구분선을 걷었다. 카드 사이 틈으로
    비치는 바닥이 그 일을 하고, 선을 남기면 비교 카드 테두리와 나란히 두 줄로 읽힌다.
  */
  it('위 구분선을 그리지 않는다 — 바닥이 비교 카드와 가른다', () => {
    // 단어 경계로 본다 — `border-transparent` 같은 다른 유틸리티에 걸리면 오탐이다
    expect(render()).not.toMatch(/\bborder-t\b/)
  })
})

/**
 * 시각 초기화 경고 — 이슈 #623 · 명세 D14-6.
 *
 * 재생성 초안에는 시각 필드가 아예 없어 되붙이면 그 날 시각이 전부 사라진다.
 * **잃을 것이 없는 날에는 경고를 내지 않는다** — D9-2 와 같은 판단이다.
 */
describe('PlanDayRegenerateConfirm — 시각 초기화 경고 (#623)', () => {
  it('시각 있는 항목이 있으면 경고를 낸다', () => {
    expect(render({ hasStartTime: true })).toContain(messages.plan.regenerateDayStartTimeReset)
  })

  it('시각 있는 항목이 없으면 경고를 내지 않는다', () => {
    expect(render({ hasStartTime: false })).not.toContain(messages.plan.regenerateDayStartTimeReset)
  })

  it('시각 경고도 다녀옴 경고와 함께 확정 버튼보다 앞이다', () => {
    const markup = render({ hasStartTime: true })

    expect(markup.indexOf(messages.plan.regenerateDayStartTimeReset)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
  })
})
