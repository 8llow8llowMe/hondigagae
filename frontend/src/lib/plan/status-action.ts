import { messages } from '@/lib/messages'
import type { PlanPhase } from '@/lib/plan/date'
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
 * 정방향 액션이 **오늘 할 만한 일인가** (#732 · 진단 665-1).
 *
 * `direction` 은 자리를 가르는 **첫 번째** 축이고, 이것이 두 번째다. 방향만 보면
 * `여행 완료하기` 는 확정 일정의 "다음 일" 이라 개요 아래 전폭 버튼인데, **출발 전날에
 * 그 버튼을 누를 사람은 없다.** 390 실측에서 D-1 화면의 유일한 filled 버튼이자 가장 큰
 * 색면이 `여행 완료하기` 였고, 그날 이 화면을 연 사람이 찾는 것(브리핑·준비물)보다 위였다.
 *
 * **`확정하기` 는 내리지 않는다.** 출발 전날의 초안은 확정할 수 있고, 그것이 정확히 그날
 * 할 일이다 — 이 판정이 가르는 것은 "정방향이냐" 가 아니라 **"아직 이를 수 없는 일이냐"**
 * 다. 정방향 전부를 내리면 #553 이 확정 버튼을 마지막 일자 끝에서 개요 아래로 끌어올린
 * 결정까지 되돌아간다 (`plan-status-action.tsx` 가 PL-2 의 "전부 메뉴로" 를 기각한 근거).
 *
 * **판정 축은 `planPhaseOf` 하나다.** 같은 화면의 D-day 배지·일자 배지·준비물 자리가 모두
 * 그 `PlanPhase` 에서 나온다 — 여기만 다른 셈을 쓰면 배지는 `D-1` 인데 버튼은 여행이
 * 시작된 것처럼 구는 날이 생긴다 (`packing-promotion.ts` 머리주석과 같은 이유).
 *
 * **날짜를 못 읽으면(`null`) 버튼으로 둔다** — 있던 진입점을 근거 없이 감추지 않는다.
 */
function isForwardActionDue(kind: PlanStatusActionKind, phase: PlanPhase | null): boolean {
  // 아직 떠나지 않은 여행을 마친 것으로 말할 수 없다. 나머지 정방향은 시점을 가리지 않는다
  return kind === 'complete' ? phase?.kind !== 'upcoming' : true
}

/** 상태 전이 액션이 각각 어디에 서는가 (#732) */
export type PlanStatusActionLayout = {
  /** 개요 카드 아래 전폭 버튼. 없으면 그 자리가 통째로 빈다 */
  button: PlanStatusActionSpec | undefined
  /** `⋯` 메뉴 항목 — 아직 이를 수 없는 정방향이 먼저, 역방향이 그 뒤다 */
  menu: PlanStatusActionSpec[]
}

/**
 * 상태 전이 액션의 자리 (#732). **한 번만 셈하고 두 진입점이 그 결과를 나눠 받는다** —
 * 버튼 쪽과 메뉴 쪽이 각자 판정하면 같은 액션이 둘 다에 서거나 어느 쪽에도 없는 날이 생긴다.
 */
export function planStatusActionLayout(
  statusCode: string,
  phase: PlanPhase | null,
): PlanStatusActionLayout {
  const reverse = reverseStatusActions(statusCode)
  const forward = forwardStatusAction(statusCode)

  if (forward === undefined) return { button: undefined, menu: reverse }
  if (isForwardActionDue(forward.kind, phase)) return { button: forward, menu: reverse }

  /*
    **메뉴 맨 위가 아니라 상태 묶음 안이다** — 호출부(`plan-manage-menu.tsx`)가 수정·복사·
    공유 다음에 이 배열을 펼친다. 정방향이 역방향보다 앞인 것은 여행의 진행 방향 그대로다.
  */
  return { button: undefined, menu: [forward, ...reverse] }
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
