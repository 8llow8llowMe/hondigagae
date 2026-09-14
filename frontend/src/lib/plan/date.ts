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

/** 일정이 오늘 기준 어디에 있는지. 갈래별 설명은 {@link planPhaseOf} 에 있다. */
export type PlanPhase =
  { kind: 'upcoming'; days: number } | { kind: 'ongoing'; day: number } | { kind: 'past' }

/**
 * 일정이 오늘 기준 어디에 있는지. **날짜 축의 판정은 여기 하나뿐이다.**
 *
 * 홈의 "다가오는 일정" 행 · 목록 · 상세가 **같은 함수를 쓴다.** 두 화면이 같은 일정에
 * 다른 말을 하면 어느 쪽이 맞는지 알 수 없다.
 *
 * 예전에는 `daysUntil`(남은 일수)과 `isPastPlan`(지남)이 따로 답했다. 둘 다 각자 맞았는데
 * **그 사이가 비어 있었다** — 이미 시작했고 아직 안 끝난 일정이 D-day 도 없이 "다가오는
 * 일정" 에 서 있었다 (#561, dev 실측 `2026-09-11 ~ 09-14` 일정을 09-14 에 봤을 때).
 * 갈래가 둘뿐이라 생긴 구멍이라 **갈래를 셋으로 못박는다.**
 *
 * | 갈래 | 조건 | 화면 |
 * |------|------|------|
 * | `past` | 종료일 < 오늘 | 지난 일정 |
 * | `ongoing` | 시작일 < 오늘 ≤ 종료일 | `여행 중` · `오늘 N일차` |
 * | `upcoming` | 오늘 ≤ 시작일 | `D-N` (당일은 `D-DAY`) |
 *
 * **출발 당일(`days === 0`)은 `upcoming` 에 남긴다.** 그날 화면이 할 말은 `D-DAY` 이고
 * 그게 `여행 중` 보다 강하다. 그래서 `ongoing.day` 는 **항상 2 이상**이고, 하루짜리
 * 일정은 `여행 중` 을 거치지 않는다.
 *
 * 날짜를 못 읽으면 `null` 이다. 호출부는 배지를 그리지 않고 다가오는 쪽에 둔다 —
 * 지난 쪽으로 미는 편이 더 위험하다 (`isPastPlan` 과 같은 판단).
 *
 * 기간이 역전된(`endDate < startDate`) 깨진 데이터는 `past` 로 떨어진다 — `ongoing` 은
 * `시작일 < 오늘 ≤ 종료일` 을 요구하므로 역전에서는 나올 수 없다. 같은 파일의
 * `totalDaysBetween` 은 역전에 `null` 을 주는데, 저쪽은 "셀 수 없다" 이고 이쪽은 "이미
 * 끝난 것으로 본다" 라 답이 갈리는 것이 맞다.
 */
export function planPhaseOf(startDate: string, endDate: string, today: Date): PlanPhase | null {
  const start = parseDay(startDate)
  if (start === null || parseDay(endDate) === null) return null

  if (isPastPlan(endDate, today)) return { kind: 'past' }

  const days = Math.round((start - todayUtc(today)) / 86_400_000)
  // days < 0 이면 이미 출발했고, 위에서 아직 안 끝난 것이 확인됐다 — 오늘이 여행 기간 안이다
  return days >= 0 ? { kind: 'upcoming', days } : { kind: 'ongoing', day: 1 - days }
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
