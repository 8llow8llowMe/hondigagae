/**
 * 일정 날짜 표기.
 *
 * **`today` 를 주입받는다** — 모듈 안에서 `new Date()` 를 부르면 테스트가 실행 시각에
 * 따라 흔들린다. 서버·클라이언트가 같은 값을 그려야 하이드레이션도 맞는다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * `'YYYY-MM-DD'` 를 UTC 자정으로 읽는다.
 *
 * **로컬 타임존으로 읽지 않는다.** `new Date('2026-09-12')` 는 UTC 로 읽히고
 * `new Date('2026-09-12T00:00:00')` 는 로컬로 읽혀, 둘을 섞으면 KST 에서 요일이
 * 하루 밀린다. 여행 날짜는 시각이 아니라 달력의 칸이라 UTC 로 통일한다.
 */
function parseDay(date: string): number | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (matched === null) return null

  const [, year, month, day] = matched as unknown as [string, string, string, string]
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day))

  // Date.UTC 는 2026-02-31 같은 값을 3월로 넘겨 버린다. 되돌려 비교해 걸러낸다
  const back = new Date(time)
  if (back.getUTCMonth() !== Number(month) - 1 || back.getUTCDate() !== Number(day)) return null

  return time
}

/** 같은 기준(UTC 자정)으로 오늘을 읽는다 */
function todayUtc(today: Date): number {
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
}

export function weekdayOf(date: string): string | null {
  const time = parseDay(date)
  if (time === null) return null
  return WEEKDAYS[new Date(time).getUTCDay()] ?? null
}

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
