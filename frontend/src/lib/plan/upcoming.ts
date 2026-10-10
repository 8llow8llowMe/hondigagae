import { isPastPlan } from '@/lib/plan/date'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 홈의 "다가오는 일정" 이 고를 일정.
 *
 * **`GET /plans` 는 날짜순이 아니다.** 계약이 그렇게 적어 두고 있다 —
 * "일정 아이디 내림차순(**최근 생성순**)으로 내려갑니다". 날짜 필터 파라미터도 없다.
 * 그래서 응답의 첫 건은 "가장 최근에 만든 일정" 이지 "가장 가까운 일정" 이 아니다.
 *
 * 그대로 `slice(0, 1)` 하면 **지나간 일정이 "다가오는 일정" 으로 뜬다** — fixture 에서
 * 오늘이 2026-09-07 인데 2026-04-11 짜리가 D-day 도 없이 걸렸다. 지난 일정에는 남은 일수를
 * 말할 수 없으므로(`planPhaseOf` 의 `past`) 화면에는 이유도 남지 않는다.
 *
 * **지난 일정의 기준은 `endDate` 다** (`isPastPlan`). 오늘이 여행 중인 날이면 그 일정은
 * 아직 지나가지 않았고, 사용자가 홈에서 제일 보고 싶은 것도 그것이다.
 *
 * 정렬 기준은 `startDate` 오름차순 — 가까운 순이다. `'YYYY-MM-DD'` 는 사전순이 곧
 * 시간순이라 문자열 비교로 충분하다 (`lib/date/day.ts` `isDayBefore` 주석과 같은 근거).
 */
export function pickUpcomingPlans(
  plans: PlanSummaryItem[],
  today: Date,
  count: number,
): PlanSummaryItem[] {
  return plans
    .filter((plan) => !isPastPlan(plan.endDate, today))
    .slice()
    .sort((a, b) => (a.startDate === b.startDate ? 0 : a.startDate < b.startDate ? -1 : 1))
    .slice(0, count)
}
