import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanStatusActionPanel } from '@/features/plan/plan-status-action-panel'
import { messages } from '@/lib/messages'
import { forwardStatusAction, PLAN_STATUS_ACTION_LABELS } from '@/lib/plan/status-action'

function render(statusCode: string, errorMessage: string | null = null) {
  return renderToStaticMarkup(
    createElement(PlanStatusActionPanel, {
      action: forwardStatusAction(statusCode),
      labels: PLAN_STATUS_ACTION_LABELS,
      errorMessage,
      saving: false,
      onAction: () => undefined,
    }),
  )
}

/*
  **정방향만 이 패널에 선다** (#653 · 진단 PL-2 · 명세 D11-2). 역방향은 `⋯` 메뉴가 갖고,
  그쪽은 `plan-manage-menu` 쪽 테스트가 본다.
*/
describe('PlanStatusActionPanel — 정방향 액션만 그린다', () => {
  it('초안은 확정만 그린다', () => {
    const markup = render('DRAFT')

    expect(markup).toContain(messages.plan.statusConfirmAction)
    expect(markup).not.toContain(messages.plan.statusCompleteAction)
  })

  it('확정은 완료만 그리고 초안 되돌리기는 그리지 않는다 — 그쪽은 메뉴다', () => {
    const markup = render('CONFIRMED')

    expect(markup).toContain(messages.plan.statusCompleteAction)
    expect(markup).not.toContain(messages.plan.statusRevertAction)
    expect(markup).not.toContain(messages.plan.statusConfirmAction)
  })

  /*
    **완료 일정에는 전폭 버튼이 없다.** 390 실측에서 그 화면의 유일한 전폭 버튼이
    `확정으로 되돌리기`(top 252) 였다 — 다녀온 일정이 가장 세게 미는 것이 되돌리기일
    이유가 없다. 그 화면의 할 일은 읽는 것이다.
  */
  it('완료는 버튼을 하나도 그리지 않는다', () => {
    expect(render('COMPLETED')).toBe('')
  })

  it('모르는 코드에서는 자리를 만들지 않는다', () => {
    expect(render('ARCHIVED')).toBe('')
  })

  it('실패 문구는 버튼 아래에 그대로 둔다', () => {
    const markup = render('CONFIRMED', messages.plan.statusCompleteError)

    expect(markup).toContain(messages.plan.statusCompleteError)
  })

  /*
    **버튼이 없어도 실패는 말해야 한다.** 역방향은 메뉴 안에서 시작하는데 메뉴는 선택과
    동시에 닫히므로, 완료 일정에서 `확정으로 되돌리기` 가 실패하면 그 사실을 낼 자리가
    이 패널뿐이다. 이 단언이 `action === undefined` 조기 반환을 막는다.
  */
  it('버튼이 없는 완료 상태에서도 실패 문구는 낸다', () => {
    const markup = render('COMPLETED', messages.plan.statusReopenError)

    expect(markup).toContain(messages.plan.statusReopenError)
  })
})

/*
  **버튼이 위아래 카드와 같은 폭이다** (#845). 래퍼가 `INSET_CLASS.card` 를 달고 있던
  동안에는 전폭 버튼이 카드보다 좌우 16(모바일) · 20(데스크톱) 씩 좁아, 레일의 세로
  경계가 이 한 줄에서만 안으로 꺾였다. 근거는 `PlanStatusActionPanel` 머리주석이다.
*/
describe('PlanStatusActionPanel — 카드 폭 (#845)', () => {
  it('래퍼가 카드 인셋을 달지 않는다', () => {
    expect(render('DRAFT')).not.toContain('px-4 md:px-5')
  })

  it('버튼은 그대로 전폭이다 — 인셋을 뗀 것이지 폭을 줄인 것이 아니다', () => {
    expect(render('DRAFT')).toContain('w-full')
  })
})
