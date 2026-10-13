import { messages } from '@/lib/messages'

/**
 * 조건 폼의 기간 안내 — 이슈 #1431. `3일 일정이에요` → `2박 3일이에요`.
 *
 * 여행 기간은 사람이 `N박 M일` 로 말한다 — 일수만 주면 숙박이 몇 번인지 다시 세야 한다. 하루짜리는
 * `0박 1일` 이 아니라 `당일치기` 다.
 *
 * @param totalDays 시작일 · 종료일을 포함해 센 일수(`totalDaysBetween`). 1 이상이다
 */
export function periodSummaryText(totalDays: number): string {
  if (totalDays <= 1) return messages.aiPlan.periodSummaryDayTrip

  return messages.aiPlan.periodSummary
    .replace('{nights}', String(totalDays - 1))
    .replace('{days}', String(totalDays))
}
