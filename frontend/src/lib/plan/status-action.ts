import { messages } from '@/lib/messages'
import type { PlanStatusCode } from '@/types/plan'

/**
 * 일정 상태 버튼. 서버는 `PUT /plans/{planId}` 의 `status` 만 받는다.
 *
 * **초안에서는 완료를 열지 않는다.** 확정하지 않은 여행을 마친 것으로 말하지 않는다.
 * **완료에서는 초안으로 되돌리지 않는다.** 다녀온 기록을 작성 중으로 되돌리는 것은
 * 다른 판단이다. 잘못 닫았으면 확정으로만 되돌린다.
 */
export type PlanStatusActionKind = 'confirm' | 'complete' | 'revert-draft' | 'reopen'

/**
 * 액션이 여행의 진행 방향으로 가는가 (#653 · 진단 PL-2).
 *
 * **자리를 가르는 축이다.** `forward` 는 그 상태에서 사용자가 할 **다음 일**이라 개요 아래
 * 전폭 버튼으로 남고, `reverse` 는 `⋯` 메뉴로 내려간다.
 *
 * **"드물다" 나 "위험하다" 로 가르지 않았다.** 상태 전이는 넷 다 되돌릴 수 있고(그래서
 * 확인 대화상자가 없다 — `plan-status-action.tsx`), 백엔드에 전이 가드도 없다. 가를 수
 * 있는 것은 **방향**뿐이다 — 390 실측에서 완료 일정의 유일한 전폭 버튼이
 * `확정으로 되돌리기` 였다(top 252). 다녀온 일정이 가장 세게 미는 것이 되돌리기일 이유가 없다.
 */
export type PlanStatusActionDirection = 'forward' | 'reverse'

export type PlanStatusActionSpec = {
  kind: PlanStatusActionKind
  nextStatus: PlanStatusCode
  variant: 'primary' | 'secondary'
  direction: PlanStatusActionDirection
}

export function planStatusActions(statusCode: string): PlanStatusActionSpec[] {
  if (statusCode === 'DRAFT') {
    return [{ kind: 'confirm', nextStatus: 'CONFIRMED', variant: 'primary', direction: 'forward' }]
  }
  if (statusCode === 'CONFIRMED') {
    return [
      { kind: 'complete', nextStatus: 'COMPLETED', variant: 'primary', direction: 'forward' },
      { kind: 'revert-draft', nextStatus: 'DRAFT', variant: 'secondary', direction: 'reverse' },
    ]
  }
  if (statusCode === 'COMPLETED') {
    return [{ kind: 'reopen', nextStatus: 'CONFIRMED', variant: 'secondary', direction: 'reverse' }]
  }
  return []
}

/**
 * 개요 카드 아래 전폭 버튼이 될 액션.
 *
 * **최대 하나다.** 한 상태에서 앞으로 가는 길은 하나뿐이라 배열을 돌려줄 이유가 없고,
 * 돌려주면 호출부가 "여러 개일 때" 를 상상해 없는 갈래를 그린다.
 * **완료 상태에서는 `undefined` 다** — 그 화면의 할 일은 읽는 것이다.
 */
export function forwardStatusAction(statusCode: string): PlanStatusActionSpec | undefined {
  return planStatusActions(statusCode).find((action) => action.direction === 'forward')
}

/** `⋯` 메뉴로 내려가는 액션. 초안에는 없다 — 되돌아갈 앞 상태가 없다 */
export function reverseStatusActions(statusCode: string): PlanStatusActionSpec[] {
  return planStatusActions(statusCode).filter((action) => action.direction === 'reverse')
}

/**
 * 액션 → 버튼·메뉴 항목의 글자.
 *
 * **훅 모듈이 아니라 여기 둔다.** 순수 표인데 `'use client'` 파일에 있으면 이것만 쓰는
 * 서버 컴포넌트·테스트까지 훅 파일을 임포트하게 된다.
 */
export const PLAN_STATUS_ACTION_LABELS: Record<PlanStatusActionKind, string> = {
  confirm: messages.plan.statusConfirmAction,
  complete: messages.plan.statusCompleteAction,
  'revert-draft': messages.plan.statusRevertAction,
  reopen: messages.plan.statusReopenAction,
}
