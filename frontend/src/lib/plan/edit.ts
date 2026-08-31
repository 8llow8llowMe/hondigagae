import { messages } from '@/lib/messages'
import type { PlanUpdatePayload } from '@/types/plan'

/**
 * 이름 · 예산 수정 폼의 값 변환과 검증. **변환은 이 한 곳에서만 한다**
 * (form-guide.md §5, `toPlanCreatePayload` 와 같은 규칙).
 */

export type PlanEditValues = {
  title: string
  /** 폼에서는 문자열이다. 빈 값이 허용된다 */
  budget: string
}

const TITLE_MAX = 60

/** 필드명 → 메시지. 서버 `PlanValidationMessage` 와 같은 문구를 쓴다 */
export function validatePlanEdit(values: PlanEditValues): Record<string, string> {
  const errors: Record<string, string> = {}

  const title = values.title.trim()
  if (title.length === 0) errors.title = messages.plan.errorTitleRequired
  else if (title.length > TITLE_MAX) errors.title = messages.plan.errorTitleTooLong

  const budget = values.budget.trim()
  if (budget !== '') {
    // 서버는 `@PositiveOrZero` 다. 소수·문자·음수를 여기서 먼저 걸러 왕복을 아낀다
    const parsed = Number(budget)
    if (!Number.isInteger(parsed) || parsed < 0) errors.budget = messages.plan.errorBudgetNegative
  }

  return errors
}

/**
 * 폼 값 → `PUT /plans/{planId}` 요청 본문.
 *
 * **예산을 비우면 `0` 을 보낸다.** `budget` 을 생략하거나 `null` 로 보내면 서버가
 * "유지" 로 읽어 예전 값이 그대로 남는다 — 지운 것이 반영되지 않는다.
 * `@PositiveOrZero` 라 0 은 유효하고, 화면도 그렇게 저장된다고 미리 말한다 (D4).
 *
 * **`status` 를 넣지 않는다.** 확정은 별도 동작이고, 여기서 함께 보내면 수정만 하려던
 * 사용자가 상태까지 바꾸게 된다.
 */
export function toPlanUpdatePayload(values: PlanEditValues): PlanUpdatePayload {
  const budget = values.budget.trim()

  return {
    title: values.title.trim(),
    budget: budget === '' ? 0 : Number(budget),
  }
}
