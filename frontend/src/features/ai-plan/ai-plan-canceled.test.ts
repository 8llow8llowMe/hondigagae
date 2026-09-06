import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanCanceled, type AiPlanCanceledProps } from '@/features/ai-plan/ai-plan-canceled'
import { messages } from '@/lib/messages'

function render(overrides: Partial<AiPlanCanceledProps> = {}) {
  const props: AiPlanCanceledProps = {
    conditionSummary: null,
    onRetry: () => undefined,
    retrying: false,
    changeHref: '/ai-plans/new?from=job-1',
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanCanceled, props))
}

describe('AiPlanCanceled — 취소는 실패가 아니다 (#250)', () => {
  it('그만뒀다고 말하고 실패 문구를 쓰지 않는다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.canceledTitle)
    expect(html).not.toContain(messages.aiPlan.failedTitle)
  })

  /*
    **`직접 만들기` 갈래를 주지 않는다.** 실패는 "AI 로는 안 되니 직접" 이 대안이지만,
    취소는 만들기 자체를 그만둔 것이라 그 제안이 맥락에 없다.
  */
  it('직접 만들기 갈래를 주지 않는다', () => {
    expect(render()).not.toContain(messages.aiPlan.failedManual)
  })

  it('같은 조건으로 다시 만들기와 조건 바꾸기 두 갈래를 준다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.canceledRetry)
    expect(html).toContain(messages.aiPlan.canceledChange)
  })

  /*
    **재제출은 조건이 남아 있을 때만 준다** — 조건 없이 같은 요청을 만들 수 없다.
    누를 수 없는 버튼을 보여 주는 대신 갈래에서 뺀다 (`AiPlanFailed` 와 같은 판단).
  */
  it('조건을 잃었으면 재제출 갈래를 감춘다', () => {
    const html = render({ onRetry: null })

    expect(html).not.toContain(messages.aiPlan.canceledRetry)
    expect(html).toContain(messages.aiPlan.canceledChange)
  })

  it('남아 있는 조건을 그대로 보여 준다', () => {
    const html = render({ conditionSummary: '10월 1일 ~ 10월 3일 · 두부' })

    expect(html).toContain('10월 1일 ~ 10월 3일 · 두부')
  })
})
