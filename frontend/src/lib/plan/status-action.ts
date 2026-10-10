import type { FailureAnnounce } from '@/lib/form/submit-failure-focus'
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
 * **"드물다" 나 "위험하다" 로 가르지 않았다.** 상태 전이는 넷 다 되돌릴 수 있다(그래서
 * 확인 대화상자가 없다 — `plan-status-action.tsx`). 백엔드의 전이 가드는 **시점** 하나뿐이고
 * (#971 — 시작일 전 `COMPLETED` 는 `PLAN_026` 400, 아래 `planStatusActionLayout`), 방향과는
 * 무관하다. 자리를 가를 수 있는 것은 **방향**이다 — 390 실측에서 완료 일정의 유일한 전폭
 * 버튼이 `확정으로 되돌리기` 였다(top 252). 다녀온 일정이 가장 세게 미는 것이 되돌리기일 이유가 없다.
 */
export type PlanStatusActionDirection = 'forward' | 'reverse'

export type PlanStatusActionSpec = {
  kind: PlanStatusActionKind
  nextStatus: PlanStatusCode
  variant: 'primary' | 'secondary'
  direction: PlanStatusActionDirection
}

/**
 * 이 전이가 서버가 읽는 반려견 특성의 **출처**를 바꾸는가 (#1058).
 *
 * 판정 · 산책 위험도 · 브리핑은 특성을 상태에 따라 읽는다 — 완료 일정은 완료 시점 스냅샷,
 * 진행 중(초안 · 확정)은 지금 프로필이다 (`PlanWeatherProcessor.loadConditions`, #629).
 * 그래서 **완료로 들어가거나 나오는 전이만** 입력을 바꾼다. 초안 ↔ 확정은 둘 다 지금 프로필이라
 * 판정을 다시 받을 이유가 없다 — 판정 재조회는 장소마다 원격 호출이라 공짜가 아니다.
 */
export function changesPetConditionSource(kind: PlanStatusActionKind): boolean {
  return kind === 'complete' || kind === 'reopen'
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
 * 정방향 액션이 오늘 **어디에** 서는가 (#732 · 진단 665-1 → #971).
 *
 * - `button` — 오늘 할 일이다. 개요 아래 전폭 버튼.
 * - `menu` — 오늘 할 수는 있지만 화면의 가장 큰 색면일 일은 아니다. `⋯` 메뉴.
 * - `hidden` — **서버가 거절할 일이다.** 어디에도 두지 않는다.
 *
 * `direction` 은 자리를 가르는 **첫 번째** 축이고, 이것이 두 번째다. 방향만 보면
 * `여행 완료하기` 는 확정 일정의 "다음 일" 이라 개요 아래 전폭 버튼인데, **출발 전날에
 * 그 버튼을 누를 사람은 없다.** 390 실측에서 D-1 화면의 유일한 filled 버튼이자 가장 큰
 * 색면이 `여행 완료하기` 였고, 그날 이 화면을 연 사람이 찾는 것(브리핑·준비물)보다 위였다.
 *
 * **시작일 전(`upcoming` · `days >= 1`)에는 메뉴에도 없다** (#971). #732 는 이 날의 완료를
 * 메뉴로 내리기만 해서 D-9 일정도 메뉴에서 완료할 수 있었다. 이제 백엔드가 **서비스 기준
 * 오늘(KST)이 시작일보다 앞이면 `PLAN_026` 400** 으로 거절한다 — 이 판정은 **서버 가드
 * `PLAN_026` 과 같은 선**이다. 서버가 거절할 액션을 보여 주고 눌러서 배우게 하지 않는다
 * (초안 공유를 `PLAN_022` 때문에 메뉴에서 뺀 것과 같은 이유 — `plan-manage-menu.tsx`).
 *
 * **출발 당일(`upcoming` · `days === 0`)은 메뉴다.** 서버는 시작일 당일부터 허용한다 —
 * 당일치기는 그날 끝에 완료한다. `planPhaseOf` 는 D-DAY 를 아직 `upcoming` 에 두므로,
 * 떠나는 날 아침의 가장 큰 색면이 `여행 완료하기` 가 되지 않게 버튼으로는 올리지 않는다.
 *
 * **`확정하기` 는 내리지 않는다.** 출발 전날의 초안은 확정할 수 있고, 그것이 정확히 그날
 * 할 일이다 — 이 판정이 가르는 것은 "정방향이냐" 가 아니라 **"아직 이를 수 없는 일이냐"**
 * 다. 정방향 전부를 내리면 #553 이 확정 버튼을 마지막 일자 끝에서 개요 아래로 끌어올린
 * 결정까지 되돌아간다 (`plan-status-action.tsx` 가 PL-2 의 "전부 메뉴로" 를 기각한 근거).
 *
 * **판정 축은 `planPhaseOf` 하나다.** 같은 화면의 D-day 배지·일자 배지·준비물 자리가 모두
 * 그 `PlanPhase` 에서 나온다 — 여기만 다른 셈을 쓰면 배지는 `D-1` 인데 버튼은 여행이
 * 시작된 것처럼 구는 날이 생긴다 (`packing-promotion.ts` 머리주석과 같은 이유). 화면의
 * `today` 는 서버가 정하므로 서버 가드의 KST 오늘과 같은 날을 본다.
 *
 * **날짜를 못 읽으면(`null`) 버튼으로 둔다** — 있던 진입점을 근거 없이 감추지 않는다.
 * 최종 판정은 서버가 한다.
 */
function forwardActionPlacement(
  kind: PlanStatusActionKind,
  phase: PlanPhase | null,
): 'button' | 'menu' | 'hidden' {
  // 나머지 정방향(`확정하기`)은 시점을 가리지 않는다
  if (kind !== 'complete' || phase?.kind !== 'upcoming') return 'button'
  // 시작일 전 완료는 서버가 `PLAN_026` 으로 거절한다 — 당일부터 허용
  return phase.days >= 1 ? 'hidden' : 'menu'
}

/** 상태 전이 액션이 각각 어디에 서는가 (#732) */
export type PlanStatusActionLayout = {
  /** 개요 카드 아래 전폭 버튼. 없으면 그 자리가 통째로 빈다 */
  button: PlanStatusActionSpec | undefined
  /** `⋯` 메뉴 항목 — 버튼으로 올리지 않은 정방향(출발 당일의 완료)이 먼저, 역방향이 그 뒤다 */
  menu: PlanStatusActionSpec[]
}

/**
 * 상태 전이 액션의 자리 (#732 · #971). **한 번만 셈하고 두 진입점이 그 결과를 나눠 받는다** —
 * 버튼 쪽과 메뉴 쪽이 각자 판정하면 같은 액션이 둘 다에 서거나 어느 쪽에도 없는 날이 생긴다.
 *
 * **어느 쪽에도 없는 것이 의도인 경우는 하나다** — 시작일 전(D-1 이전)의 `여행 완료하기`.
 * 서버가 `PLAN_026` 으로 거절하는 액션이라 진입점을 두지 않는다 (`forwardActionPlacement`).
 */
export function planStatusActionLayout(
  statusCode: string,
  phase: PlanPhase | null,
): PlanStatusActionLayout {
  const reverse = reverseStatusActions(statusCode)
  const forward = forwardStatusAction(statusCode)

  if (forward === undefined) return { button: undefined, menu: reverse }

  const placement = forwardActionPlacement(forward.kind, phase)
  if (placement === 'button') return { button: forward, menu: reverse }
  if (placement === 'hidden') return { button: undefined, menu: reverse }

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

/**
 * 버튼 아래 한 줄 — **그 액션이 무엇을 여는지** (#1154).
 *
 * `확정하기` 만 갖는다. AI 로 담은 일정은 늘 초안이고 초안은 공유할 수 없는데(`PLAN_022`),
 * 그 사실을 화면 어디서도 말하지 않아 2026-10-06 사용성 점검의 "친구에게 공유" 과제가
 * 멈췄다. 사용자가 다음에 할 일을 보는 자리가 이 버튼이라 여기서 말한다.
 */
export const PLAN_STATUS_ACTION_NOTES: Partial<Record<PlanStatusActionKind, string>> = {
  confirm: messages.plan.confirmUnlocksShare,
}

/**
 * 전이가 끝난 뒤 그 자리에 남는 한 줄 (#1174).
 *
 * **네 전이 모두 갖는다.** 2회차 사용성 점검에서 `일정 확정하기` 를 누르면 버튼이 사라지기만
 * 하고 토스트도 낭독도 없었다 — 포커스는 `BODY` 로 떨어졌다. 출발 전 확정 일정과 완료 일정은
 * 전폭 버튼 자리가 통째로 비므로 완료하기도 같은 낙하를 겪고, 메뉴에서 시작하는 역방향은
 * 배지 글자 하나만 바뀐다. 한 갈래만 말하면 나머지가 "아무 일도 없었다" 로 읽힌다.
 *
 * **토스트가 아니라 그 자리다** (사용자 결정 2026-10-06). 확정의 다음 행동(공유)을 같은 자리에
 * 두려면 사라지지 않아야 하고, 토스트의 액션은 "결과를 확인하는 링크" 하나뿐이다(`toast.tsx`).
 */
export const PLAN_STATUS_RESULT_MESSAGES: Record<PlanStatusActionKind, string> = {
  confirm: messages.plan.statusConfirmDone,
  complete: messages.plan.statusCompleteDone,
  'revert-draft': messages.plan.statusRevertDone,
  reopen: messages.plan.statusReopenDone,
}

/**
 * 결과 안내 아래에 `공유 링크` 를 세우는가 (#1174).
 *
 * **확정만이다.** 확정의 이유가 공유였다(#1154 — 버튼 아래 `확정하면 링크로 일정을 공유할 수
 * 있어요`). 공유는 그동안 `⋯` 메뉴 안에만 있어, 방금 연 문을 사용자가 다시 찾아야 했다.
 * 완료 · 되돌리기는 공유 가능 여부를 새로 열지 않는다 — 메뉴의 항목이 그대로 그 자리다.
 */
export function statusResultOpensShare(kind: PlanStatusActionKind): boolean {
  return kind === 'confirm'
}

/**
 * 그 결과가 **지금 상태와 맞는가** (#1174).
 *
 * 결과는 다음 전이를 시작할 때만 걷히는데, 그사이 다른 탭 · 기기에서 상태가 바뀌어 상세가
 * 다시 조회되면(방문 체크 · 시각 · 수정이 상세를 invalidate 한다) 배지는 `초안` 인데 "확정했어요"
 * 와 `공유 링크` 가 남는다 — 그 버튼은 `PLAN_022` 로 거절될 모달을 연다. 전이의 도착 상태가
 * 지금 상태일 때만 그린다.
 */
export function statusResultMatches(kind: PlanStatusActionKind, statusCode: string): boolean {
  return RESULT_STATUS[kind] === statusCode
}

/** 전이의 도착 상태 — `planStatusActions` 의 `nextStatus` 와 같은 값이다 (테스트가 묶는다) */
const RESULT_STATUS: Record<PlanStatusActionKind, PlanStatusCode> = {
  confirm: 'CONFIRMED',
  complete: 'COMPLETED',
  'revert-draft': 'DRAFT',
  reopen: 'CONFIRMED',
}

/** 마지막으로 성공한 전이와 그 결과가 읽히는 길 (#1174) */
export type PlanStatusResult = {
  kind: PlanStatusActionKind
  announce: FailureAnnounce
}

/**
 * 마지막 전이의 실패와 그 문구가 읽히는 길 (#1203).
 *
 * **문구만 들지 않는다.** 성공(`PlanStatusResult`)과 같은 이유다 — 전폭 버튼에서 시작한 실패는
 * 요청 중 버튼이 `disabled` 라 포커스가 `BODY` 로 떨어져 있고, 실패해 버튼이 살아나도 브라우저는
 * 돌려주지 않는다. 읽히는 길을 응답 시점에 정해 문구와 함께 든다.
 */
export type PlanStatusFailure = {
  message: string
  announce: FailureAnnounce
}

/**
 * 전이의 결과 · 실패가 **무엇으로 읽히는가** — 포커스냐 `role="status"`·`role="alert"` 냐
 * (#1174 · #1203 · form-guide.md §8).
 *
 * **실패도 이 판정이다** (#1203). 실패 문구(`FormAlert`)가 `role="alert"` 로 읽히기만 하고
 * 포커스는 `BODY` 에 남아, 키보드 사용자가 문서 맨 위에서 다시 시작했다. 성공과 실패는 응답이
 * 온 순간의 포커스가 같으므로 같은 판정을 쓴다 — 메뉴에서 시작한 실패는 `⋯` 에 둔 채 알림이다.
 *
 * **응답이 온 순간 포커스가 어디 있는가**로 가른다. 전폭 버튼에서 시작하면 요청 중 버튼이
 * `disabled` 라 포커스가 이미 `BODY` 다 — 안내로 옮긴다(`focus`). 메뉴에서 시작하면 메뉴가
 * 닫히며 포커스를 `⋯` 트리거로 돌려준다 — 거기 둔 채 `role="status"` 로 읽힌다(`live`).
 * 출발 당일의 `여행 완료하기` 는 정방향인데 메뉴에서 시작하므로 방향으로는 가를 수 없다.
 *
 * **`disabled` 인 요소에 남은 포커스도 잃은 것으로 본다.** 비활성이 된 버튼에서 포커스를
 * `BODY` 로 떨어뜨리는 시점은 브라우저마다 다르다 — 그 버튼은 곧 사라지거나(출발 전 확정)
 * 다른 액션이 되므로, 거기 둔 채 낭독하면 다음 렌더에 포커스가 결국 `BODY` 로 간다.
 *
 * **둘 중 하나만이다** (#1102). 포커스를 옮기면서 역할까지 두면 같은 문구를 두 번 읽는다.
 * 그래서 값은 포커스 effect 와 같은 이 판정 하나에서 나온다.
 */
export function planStatusResultAnnounce(
  activeElement: Element | null,
  body: Element | null,
): FailureAnnounce {
  if (activeElement === null || activeElement === body) return 'focus'
  return 'disabled' in activeElement && activeElement.disabled === true ? 'focus' : 'live'
}
