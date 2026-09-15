import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanStatusActionPanel } from '@/features/plan/plan-status-action-panel'
import { messages } from '@/lib/messages'
import { planStatusActions } from '@/lib/plan/status-action'

const LABELS = {
  confirm: messages.plan.statusConfirmAction,
  complete: messages.plan.statusCompleteAction,
  'revert-draft': messages.plan.statusRevertAction,
  reopen: messages.plan.statusReopenAction,
}

function render(statusCode: string, errorMessage: string | null = null) {
  return renderToStaticMarkup(
    createElement(PlanStatusActionPanel, {
      actions: planStatusActions(statusCode),
      labels: LABELS,
      errorMessage,
      saving: false,
      onAction: () => undefined,
    }),
  )
}

describe('PlanStatusActionPanel — 상태별 버튼', () => {
  it('초안은 확정만 그리고 완료는 그리지 않는다', () => {
    const markup = render('DRAFT')
    expect(markup).toContain(messages.plan.statusConfirmAction)
    expect(markup).not.toContain(messages.plan.statusCompleteAction)
    expect(markup).not.toContain(messages.plan.statusRevertAction)
  })

  it('확정은 완료와 초안 되돌리기를 함께 그린다', () => {
    const markup = render('CONFIRMED')
    expect(markup).toContain(messages.plan.statusCompleteAction)
    expect(markup).toContain(messages.plan.statusRevertAction)
    expect(markup).not.toContain(messages.plan.statusConfirmAction)
  })

  it('완료는 확정으로 되돌리기만 그린다 — 초안 되돌리기는 없다', () => {
    const markup = render('COMPLETED')
    expect(markup).toContain(messages.plan.statusReopenAction)
    expect(markup).not.toContain(messages.plan.statusRevertAction)
    expect(markup).not.toContain(messages.plan.statusCompleteAction)
  })

  it('모르는 코드에서는 자리를 만들지 않는다', () => {
    expect(render('ARCHIVED')).toBe('')
  })

  it('실패 문구는 버튼 아래에 그대로 둔다', () => {
    const markup = render('CONFIRMED', messages.plan.statusCompleteError)
    expect(markup).toContain(messages.plan.statusCompleteError)
  })
})
