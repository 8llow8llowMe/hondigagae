import { messages } from '@/lib/messages'
import { planBudgetIssue } from '@/lib/plan/budget'
import { planPeriodIssue } from '@/lib/plan/period'
import type { PlanUpdatePayload } from '@/types/plan'

/**
 * 이름 · 기간 · 예산 수정 폼의 값 변환과 검증. **변환은 이 한 곳에서만 한다**
 * (form-guide.md §5, `toPlanCreatePayload` 와 같은 규칙).
 */

export type PlanEditValues = {
  title: string
  /** `YYYY-MM-DD`. `DateField` 가 이 서식으로만 값을 준다 */
  startDate: string
  /** `YYYY-MM-DD` */
  endDate: string
  /** 폼에서는 문자열이다. 빈 값이 허용된다 */
  budget: string
}

const TITLE_MAX = 60

/** `YYYY-MM-DD`. 만들기 스키마(`features/plan/schemas.ts`)와 같은 이유로 서식을 확인한다 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 필드명 → 메시지. 서버 `PlanValidationMessage` 와 같은 문구를 쓴다 */
export function validatePlanEdit(values: PlanEditValues): Record<string, string> {
  const errors: Record<string, string> = {}

  const title = values.title.trim()
  if (title.length === 0) errors.title = messages.plan.errorTitleRequired
  else if (title.length > TITLE_MAX) errors.title = messages.plan.errorTitleTooLong

  /*
    **기간은 여기서 연다** (#585). 닫아 뒀던 근거(고아 항목)는 서버가 `PLAN_008` 로
    거부하면서 사라졌다 — `types/plan.ts` 의 `PlanUpdatePayload` 주석 참고.

    서식을 먼저 보고 관계(역전·상한)를 그다음에 본다. 순서를 뒤집으면 빈 값에 "시작일은
    종료일보다 늦을 수 없습니다" 가 붙는다.
  */
  if (!DATE_PATTERN.test(values.startDate)) errors.startDate = messages.plan.errorStartDateRequired
  if (!DATE_PATTERN.test(values.endDate)) errors.endDate = messages.plan.errorEndDateRequired

  /*
    판정은 만들기 폼과 **같은 함수**(`planPeriodIssue`)다. 오류는 종료일에 붙인다 —
    만들기 폼의 `refine(path: ['endDate'])` 과 같은 자리이고, 사용자가 방금 고른 쪽이다.
  */
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

  /*
    서버는 `@PositiveOrZero` 다. 소수·문자·음수를 여기서 먼저 걸러 왕복을 아낀다.

    **상한도 본다.** 만들기 폼과 같은 판정(`planBudgetIssue`)을 쓴다 — 예전에는 이쪽만
    상한이 없어, 수정 모달로 큰 수를 넣으면 서버가 역직렬화에서 깨지며 개발자용 문구가
    그대로 떴다 (#566).

    같은 함수로 옮기면서 `1e3` · `+5` 처럼 `Number()` 는 통과하지만 서식이 아닌 값도
    함께 막힌다. 만들기 폼은 원래 막고 있었으므로 두 폼이 이제 같은 답을 낸다.
  */
  switch (planBudgetIssue(values.budget)) {
    case 'invalid':
      errors.budget = messages.plan.errorBudgetNegative
      break
    case 'too-large':
      errors.budget = messages.plan.errorBudgetTooLarge
      break
    default:
      break
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
 * **기간은 바뀌지 않았어도 두 날짜를 함께 보낸다** (#585). 부분 수정이라 생략해도
 * 결과는 같지만, 한쪽만 보내는 경로를 만들지 않으려는 것이다 — 시작일만 보내면 서버가
 * 새 시작일과 옛 종료일로 기간을 다시 계산한다 (`PlanUpdatePayload` 주석).
 *
 * **`status` 를 넣지 않는다.** 확정은 별도 동작이고, 여기서 함께 보내면 수정만 하려던
 * 사용자가 상태까지 바꾸게 된다.
 */
export function toPlanUpdatePayload(values: PlanEditValues): PlanUpdatePayload {
  const budget = values.budget.trim()

  return {
    title: values.title.trim(),
    startDate: values.startDate,
    endDate: values.endDate,
    budget: budget === '' ? 0 : Number(budget),
  }
}
