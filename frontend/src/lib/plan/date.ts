import { parseDay, todayUtc, weekdayOf } from '@/lib/date/day'

/**
 * 일정 날짜 표기.
 *
 * **`today` 를 주입받는다** — 모듈 안에서 `new Date()` 를 부르면 테스트가 실행 시각에
 * 따라 흔들린다. 서버·클라이언트가 같은 값을 그려야 하이드레이션도 맞는다.
 *
 * 날짜 문자열을 읽는 규칙 자체는 `lib/date/day.ts` 가 소유한다 — 달력 UI 가 같은 규칙을
 * 쓰게 되면서 밖으로 꺼냈다. **여기는 "일정 화면의 표기" 만 갖는다.**
 */

// 기존 호출부(`plan-item-row` 등)가 이 경로로 가져다 쓰고 있어 다시 내보낸다
export { weekdayOf }

/**
 * 아트보드 04·05 의 날짜 줄 — `2026-09-12 (토) – 09-14 (월)`.
 *
 * 종료일은 **연도를 반복하지 않는다.** 다만 해를 넘기는 일정은 연도를 다시 쓴다 —
 * `2026-12-30 (수) – 2027-01-02 (토)` 를 `12-30 – 01-02` 로 쓰면 거꾸로 읽힌다.
 * 하루짜리 일정은 한 번만 쓴다.
 */
export function formatPlanDateRange(startDate: string, endDate: string): string {
  const startLabel = formatDay(startDate)
  if (startLabel === null) return startDate

  if (startDate === endDate) return startLabel

  const endLabel = formatDay(endDate)
  if (endLabel === null) return startLabel

  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4)
  return `${startLabel} – ${sameYear ? endLabel.slice(5) : endLabel}`
}

function formatDay(date: string): string | null {
  const weekday = weekdayOf(date)
  return weekday === null ? null : `${date} (${weekday})`
}

/**
 * 남은 일수. 이미 시작한 일정은 `null` — D-day 를 말하지 않는다.
 *
 * 홈의 "다가오는 일정" 행과 목록이 **같은 함수를 쓴다.** 두 화면이 같은 일정에 다른
 * D-day 를 말하면 어느 쪽이 맞는지 알 수 없다.
 */
export function daysUntil(startDate: string, today: Date): number | null {
  const start = parseDay(startDate)
  if (start === null) return null

  const days = Math.round((start - todayUtc(today)) / 86_400_000)
  return days < 0 ? null : days
}

/** 종료일이 오늘보다 이전이면 지난 일정이다. **상태(`COMPLETED`)와는 다른 축이다** */
export function isPastPlan(endDate: string, today: Date): boolean {
  const end = parseDay(endDate)
  // 날짜를 못 읽으면 지난 일정으로 밀지 않는다 — 다가오는 쪽에 두는 편이 덜 위험하다
  if (end === null) return false

  return end < todayUtc(today)
}

/**
 * 시작일에서 `offset` 일 뒤의 날짜(`YYYY-MM-DD`).
 *
 * 일자 섹션의 날짜는 **판정 응답이 아니라 일정 기간에서 만든다** — 판정이 실패해도
 * `2일차 09-13 (일)` 은 그대로 보여야 한다. 날짜를 못 읽으면 `null` 이다.
 */
export function addPlanDays(startDate: string, offset: number): string | null {
  const start = parseDay(startDate)
  if (start === null) return null

  return new Date(start + offset * 86_400_000).toISOString().slice(0, 10)
}

/**
 * 여행 총 일수 (양끝 포함). 날짜를 못 읽거나 역전이면 `null`.
 *
 * **담기 전에는 서버가 `totalDays` 를 주지 않는다** — AI 초안 화면이 "3일 중 2일만
 * 만들었어요" 를 말하려면 기간에서 직접 세야 한다 (ai-plan 명세 S6).
 * 백엔드 `PlanDetailResponse.totalDays` 와 같은 셈이어야 두 화면이 같은 일수를 말한다.
 */
export function totalDaysBetween(startDate: string, endDate: string): number | null {
  const start = parseDay(startDate)
  const end = parseDay(endDate)
  if (start === null || end === null) return null
  if (end < start) return null

  return Math.round((end - start) / 86_400_000) + 1
}
