import { parseDay } from '@/lib/date/day'
import { totalDaysBetween } from '@/lib/plan/date'

/**
 * 여행 기간 판정. **일정 만들기와 일정 수정이 같은 함수를 쓴다** — `planBudgetIssue` 와
 * 같은 이유다. 두 폼이 같은 기간에 다른 답을 내면 어느 쪽이 맞는지 알 수 없다.
 *
 * 예전에는 만들기 폼만 역전(`startDate > endDate`)을 봤고 상한은 어느 쪽도 보지 않았다 —
 * 31일짜리를 만들면 서버 `PLAN_009` 가 왕복 뒤에 돌려줬다. #585 로 수정 폼이 기간을
 * 열면서 **같은 판정을 둘 곳이 두 곳**이 됐으므로 함수 하나로 못박는다.
 */

/**
 * 여행 기간 상한 (양끝 포함). **서버 제약의 복제본이다** (`form-guide.md §5`).
 *
 * 근거는 `PlanErrorCode.PLAN_PERIOD_TOO_LONG` — *"여행 기간은 최대 30일까지 만들 수
 * 있습니다."* 이고, `PlanCreateRequest.endDate` · `PlanUpdateRequest.endDate` 의 스키마
 * 설명도 같은 값을 적는다 (dev Swagger 실측 2026-09-14).
 *
 * **AI 일정 생성의 10일(`AIPLAN_018`)과 다른 값이다.** 저쪽은 예보 커버리지와 프롬프트
 * 규모에 맞춘 별개의 상한이라 여기서 같이 쓰지 않는다.
 */
export const PLAN_PERIOD_MAX_DAYS = 30

/** 기간 값의 문제. 둘 중 하나가 비었거나 서식이 아니면 문제로 보지 않는다 */
export type PlanPeriodIssue = 'reversed' | 'too-long'

/**
 * 시작일·종료일 한 쌍을 판정한다. 문제가 없으면 `null`.
 *
 * **서식은 보지 않는다.** 빈 값·깨진 서식은 각 필드가 따로 말하므로(`errorStartDateRequired`
 * / `errorEndDateRequired`) 여기서 또 답하면 같은 오류가 두 자리에 뜬다.
 *
 * 역전을 상한보다 먼저 본다 — 역전이면 일수를 셀 수 없고, `2026-09-14 ~ 2026-01-01` 에
 * "30일을 넘었어요" 라고 말하면 틀린 진단이다.
 */
export function planPeriodIssue(startDate: string, endDate: string): PlanPeriodIssue | null {
  const start = parseDay(startDate)
  const end = parseDay(endDate)
  if (start === null || end === null) return null

  if (end < start) return 'reversed'

  /*
    셈은 `totalDaysBetween` 하나가 갖는다 — 백엔드 `PlanDetailResponse.totalDays` 와 같은
    셈이어야 화면과 서버가 같은 일수를 말한다. 위 두 검사를 통과했으면 `null` 이 나올 수
    없지만, 셈을 여기서 다시 쓰지 않으려고 방어만 둔다.
  */
  const days = totalDaysBetween(startDate, endDate)
  return days !== null && days > PLAN_PERIOD_MAX_DAYS ? 'too-long' : null
}
