import { messages } from '@/lib/messages'
import { addPlanDays, isPastPlan, planPhaseOf } from '@/lib/plan/date'
import { planPeriodIssue } from '@/lib/plan/period'
import type { CodeNameMetadata } from '@/types/api'
import type { PlanCopyPayload } from '@/types/plan'

/**
 * 일정 복사 — 순수 판정·변환. 정본은 `docs/features/plan/일정복사-세부명세.md`(이슈 #617).
 */

/** `PlanManageMenu` 에서 `canCopyPlan` 을 부르는 데 필요한 최소 필드 */
export type PlanCopyCandidate = {
  startDate: string
  endDate: string
  status: CodeNameMetadata
}

/**
 * `이 일정 복사하기` 메뉴 항목이 보이는가 — **지난 OR 완료** (D4-1 · D17-2).
 *
 * **`isPastPlan` 과 `status.code === 'COMPLETED'` 는 다른 축이다** — 날짜가 아직 안
 * 지났어도 완료 처리한 일정, 완료 처리를 안 한 지난 일정 둘 다 대상이다
 * (`lib/plan/date.ts:86` 의 같은 판단).
 *
 * **날짜를 못 읽는 데이터는 상태와 무관하게 숨는다.** `isPastPlan` 은 그 경우 `false` 를
 * 주지만, `status.code === 'COMPLETED'` 축은 날짜를 보지 않으므로 이 함수가 먼저
 * `planPhaseOf` 로 걸러 둔다 — 아니면 깨진 날짜의 완료 일정이 새는 구멍이 생긴다.
 *
 * `today` 는 **서버가 내려준 값**을 받는다. 클라이언트가 `new Date()` 를 새로 부르면
 * 자정 근처에서 SSR 과 갈린다 (`plan-manage-menu.tsx:62` 와 같은 근거).
 */
export function canCopyPlan(plan: PlanCopyCandidate, today: Date): boolean {
  if (planPhaseOf(plan.startDate, plan.endDate, today) === null) return false

  return isPastPlan(plan.endDate, today) || plan.status.code === 'COMPLETED'
}

/**
 * 시작일을 고른 뒤 종료일의 **기본값**(검증이 아니다, D4-3). 원본과 같은 일수로 채운다.
 *
 * `totalDays === 1` 이면 시작일과 같다(하루짜리). 서식이 아닌 시작일은 `null` —
 * 호출부는 그 경우 종료일을 건드리지 않는다.
 */
export function copyEndDateFor(startDate: string, totalDays: number): string | null {
  return addPlanDays(startDate, totalDays - 1)
}

export type PlanCopyValues = {
  /** `YYYY-MM-DD`. `DateField` 가 이 서식으로만 값을 준다 */
  startDate: string
  /** `YYYY-MM-DD` */
  endDate: string
}

/** `YYYY-MM-DD`. `lib/plan/edit.ts` 와 같은 서식 검사 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 필드명 → 메시지. **상한은 막고 일수 일치는 막지 않는다** (D4-2).
 *
 * `planPeriodIssue` 를 만들기 폼 · 수정 모달과 **그대로 재사용**한다 — 세 폼이 같은
 * 기간에 다른 답을 내면 어느 쪽이 맞는지 알 수 없다(`period.ts:4-11`). 순서도 서버와
 * 같다 — 역전 → 상한을 먼저 보고, 일수 비교(`PLAN_021`)는 서버만 한다.
 *
 * **일수 일치를 여기서 세지 않는다.** 원본 일수와 비교하는 코드를 추가하면 서버 규칙
 * (`PLAN_021`)의 복제본이 생긴다 — `PLAN_008` 을 화면이 다시 세지 않기로 한 #585 의
 * 결정과 같은 이유다. 거절은 서버 `resultMessage` 를 그대로 배너에 띄운다.
 */
export function validatePlanCopy(values: PlanCopyValues): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!DATE_PATTERN.test(values.startDate)) errors.startDate = messages.plan.errorStartDateRequired
  if (!DATE_PATTERN.test(values.endDate)) errors.endDate = messages.plan.errorEndDateRequired

  switch (planPeriodIssue(values.startDate, values.endDate)) {
    case 'reversed':
      errors.endDate = messages.plan.errorDateRange
      break
    case 'too-long':
      errors.endDate = messages.plan.errorPeriodTooLong
      break
    default:
      break
  }

  return errors
}

/**
 * 폼 값 → `POST /plans/{planId}/copy` 요청 본문.
 *
 * **`title` 을 넣지 않는다** (D0-1 · D3-1 · D8 #2). 서버가 원본 제목 뒤에 ` (복사)` 를
 * 붙이고 60자를 넘으면 앞을 잘라 맞춘다 — 그 계산을 화면이 복제하지 않는다.
 */
export function toPlanCopyPayload(values: PlanCopyValues): PlanCopyPayload {
  return { startDate: values.startDate, endDate: values.endDate }
}
