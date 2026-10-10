import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanStatusActionPanel } from '@/features/plan/plan-status-action-panel'
import { messages } from '@/lib/messages'
import {
  forwardStatusAction,
  PLAN_STATUS_ACTION_LABELS,
  PLAN_STATUS_ACTION_NOTES,
  PLAN_STATUS_RESULT_MESSAGES,
  type PlanStatusActionSpec,
  type PlanStatusFailure,
  type PlanStatusResult,
} from '@/lib/plan/status-action'

function renderPanel({
  action,
  failure = null,
  result = null,
}: {
  action: PlanStatusActionSpec | undefined
  failure?: PlanStatusFailure | null
  result?: PlanStatusResult | null
}) {
  return renderToStaticMarkup(
    createElement(PlanStatusActionPanel, {
      action,
      labels: PLAN_STATUS_ACTION_LABELS,
      notes: PLAN_STATUS_ACTION_NOTES,
      failure,
      result,
      resultMessages: PLAN_STATUS_RESULT_MESSAGES,
      onShare: () => undefined,
      saving: false,
      onAction: () => undefined,
    }),
  )
}

function render(statusCode: string, errorMessage: string | null = null) {
  const failure: PlanStatusFailure | null =
    errorMessage === null ? null : { message: errorMessage, announce: 'live' }
  return renderPanel({ action: forwardStatusAction(statusCode), failure })
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

/*
  **확정이 무엇을 여는지 말한다** (#1154). AI 로 담은 일정은 늘 초안이고 초안은 공유할 수
  없는데, 그 사실을 아무 데서도 말하지 않아 "친구에게 공유" 과제가 멈췄다.
*/
describe('PlanStatusActionPanel — 확정 버튼 아래 안내 (#1154)', () => {
  it('초안의 확정 버튼 아래에 공유가 열린다고 말한다', () => {
    expect(render('DRAFT')).toContain(messages.plan.confirmUnlocksShare)
  })

  it('안내를 버튼의 설명으로 잇는다 — 스크린 리더가 버튼과 함께 읽는다', () => {
    const markup = render('DRAFT')
    const describedBy = /<button[^>]*aria-describedby="([^"]+)"/.exec(markup)?.[1]

    expect(describedBy).toBeDefined()
    expect(markup).toContain(`id="${describedBy ?? ''}"`)
  })

  it('확정 뒤(완료 버튼)에는 붙이지 않는다', () => {
    expect(render('CONFIRMED')).not.toContain(messages.plan.confirmUnlocksShare)
  })
})

/*
  **전이가 끝나면 그 자리가 결과를 말한다** (#1174). 2회차 사용성 점검에서 `일정 확정하기` 를
  누르면 버튼이 사라지기만 하고 포커스가 `BODY` 로 떨어졌다 — 출발 전 확정 일정은 버튼 자리가
  통째로 비기 때문이다(`action === undefined`). 그 갈래에서도 패널이 남아야 한다.
*/
describe('PlanStatusActionPanel — 전이 결과 (#1174)', () => {
  const confirmed: PlanStatusResult = { kind: 'confirm', announce: 'focus' }

  it('출발 전 확정처럼 버튼이 없어도 결과 안내와 공유 링크가 선다', () => {
    const markup = renderPanel({ action: undefined, result: confirmed })

    expect(markup).toContain(messages.plan.statusConfirmDone)
    expect(markup).toContain(`>${messages.plan.shareAction}</button>`)
  })

  it('결과가 다음 행동보다 먼저다 — 포커스가 내려앉은 뒤 읽는 순서', () => {
    const markup = renderPanel({ action: forwardStatusAction('CONFIRMED'), result: confirmed })

    const done = markup.indexOf(messages.plan.statusConfirmDone)
    const share = markup.indexOf(`>${messages.plan.shareAction}<`)
    const complete = markup.indexOf(messages.plan.statusCompleteAction)

    expect(done).toBeGreaterThanOrEqual(0)
    expect(done).toBeLessThan(share)
    expect(share).toBeLessThan(complete)
  })

  it.each(['complete', 'revert-draft', 'reopen'] as const)(
    '%s 결과에는 공유 링크를 세우지 않는다 — 공유 가능 여부를 새로 열지 않는다',
    (kind) => {
      const markup = renderPanel({ action: undefined, result: { kind, announce: 'live' } })

      expect(markup).toContain(PLAN_STATUS_RESULT_MESSAGES[kind])
      expect(markup).not.toContain(`>${messages.plan.shareAction}<`)
    },
  )

  /*
   **포커스냐 낭독이냐, 하나만** (form-guide.md §8 · #1102). 둘 다 두면 같은 문구를 두 번 읽는다.
   */
  it('포커스를 받는 결과는 역할 없이 tabindex=-1 이다', () => {
    const markup = renderPanel({ action: undefined, result: confirmed })

    expect(markup).toContain('tabindex="-1"')
    expect(markup).not.toContain('role="status"')
  })

  it('메뉴에서 온 결과는 포커스를 두고 role=status 로 읽힌다', () => {
    const markup = renderPanel({
      action: forwardStatusAction('DRAFT'),
      result: { kind: 'revert-draft', announce: 'live' },
    })

    expect(markup).toContain('role="status"')
    expect(markup).not.toContain('tabindex="-1"')
  })

  it('결과도 실패도 없으면 완료 일정의 자리는 여전히 비어 있다', () => {
    expect(renderPanel({ action: undefined })).toBe('')
  })
})

describe('PlanStatusActionPanel — 전이 실패의 낭독 경로 (#1203)', () => {
  /*
    **전폭 버튼에서 온 실패는 포커스로 읽힌다.** 요청 중 버튼이 `disabled` 라 포커스가 `BODY` 로
    떨어졌다 — 역할을 떼고 알림이 포커스를 받는다(form-guide.md §8 · #1102). 둘 다 두면 두 번 읽힌다.
  */
  it('포커스를 받는 실패는 역할 없이 tabindex=-1 이다', () => {
    const markup = renderPanel({
      action: forwardStatusAction('DRAFT'),
      failure: { message: messages.plan.statusConfirmError, announce: 'focus' },
    })

    expect(markup).toContain(messages.plan.statusConfirmError)
    expect(markup).not.toContain('role="alert"')
    expect(markup).toContain('data-form-alert=""')
    expect(markup).toContain('tabindex="-1"')
  })

  it('메뉴에서 온 실패는 포커스를 ⋯ 에 두고 role=alert 로 읽힌다', () => {
    const markup = renderPanel({
      action: undefined,
      failure: { message: messages.plan.statusReopenError, announce: 'live' },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.statusReopenError)
  })

  it('실패가 버튼 아래다 — 포커스가 내려앉은 뒤 Shift+Tab 이 다시 시도할 버튼이다', () => {
    const markup = renderPanel({
      action: forwardStatusAction('DRAFT'),
      failure: { message: messages.plan.statusConfirmError, announce: 'focus' },
    })

    expect(markup.indexOf(messages.plan.statusConfirmAction)).toBeLessThan(
      markup.indexOf(messages.plan.statusConfirmError),
    )
  })
})
