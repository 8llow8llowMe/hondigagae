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
 * 일정 화면의 **날짜 한 칸** — `9월 19일 (토)`. 못 읽으면 `null`.
 *
 * **이 저장소에서 일정 날짜를 글자로 옮기는 곳은 여기 하나다** (#732). 예전에는 화면마다
 * 자기 방식으로 잘라 썼다 — 개요가 `2026-09-19 (토)`, 일자 카드가 `09-19 (토)`
 * (`date.slice(5)` + `weekdayOf`). 나란히 놓으면 **같은 날을 두 모양으로 부르는** 셈이라,
 * 브리핑([#733](https://github.com/8llow8llowMe/hondigagae/issues/733))이 세 번째 모양을
 * 만들기 전에 한 곳으로 모은다.
 *
 * **ISO 를 그대로 쓰지 않는다.** `09-19` 는 날짜가 아니라 기계 값으로 읽히고, 앞자리가
 * 월인지 일인지도 글자만으로는 말해 주지 않는다. `9월 19일` 은 그 모호함이 없다.
 *
 * **앞자리 0 을 버린다** (`09월` 이 아니라 `9월`) — 자릿수를 맞춰야 하는 표가 아니라
 * 문장 안의 날짜다.
 *
 * **연도가 없다.** 연도를 말해야 하는 자리는 `formatPlanDayWithYear` 를 쓴다.
 */
export function formatPlanDay(date: string): string | null {
  const weekday = weekdayOf(date)
  if (weekday === null) return null

  // `weekdayOf` 가 형식과 실재하는 날짜까지 확인한 뒤라 잘라 읽어도 안전하다
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${weekday})`
}

/** `2026년 9월 19일 (토)`. 연도가 정보인 자리(기간 줄의 시작일)가 쓴다 */
export function formatPlanDayWithYear(date: string): string | null {
  const label = formatPlanDay(date)
  return label === null ? null : `${date.slice(0, 4)}년 ${label}`
}

/**
 * 아트보드 04·05 의 날짜 줄 — `2026년 9월 12일 (토) – 9월 14일 (월)`.
 *
 * 종료일은 **연도를 반복하지 않는다.** 다만 해를 넘기는 일정은 연도를 다시 쓴다 —
 * `2026년 12월 30일 (수) – 2027년 1월 2일 (토)` 에서 뒤 연도를 빼면 거꾸로 읽힌다.
 * 하루짜리 일정은 한 번만 쓴다.
 *
 * **연도를 통째로 버리지 않는다** (#732). 날짜 **모양**은 `formatPlanDay` 로 통일하되,
 * 이 줄은 목록·상세에서 지난 해의 일정까지 가리키므로 연도가 정보다 — 모양을 맞추자고
 * 있던 사실을 지우지 않는다.
 */
export function formatPlanDateRange(startDate: string, endDate: string): string {
  const startLabel = formatPlanDayWithYear(startDate)
  if (startLabel === null) return startDate

  if (startDate === endDate) return startLabel

  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4)
  const endLabel = sameYear ? formatPlanDay(endDate) : formatPlanDayWithYear(endDate)
  if (endLabel === null) return startLabel

  return `${startLabel} – ${endLabel}`
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

/**
 * 항목 시작 시각 — `'10:30:00'` → `'10:30'`. 못 읽으면 `null`.
 *
 * **초를 버린다.** 백엔드 `LocalTime` 이 초까지 주지만 여행 일정에서 초는 의미가 없고,
 * `10:30:00` 은 시간표가 아니라 기계 값으로 읽힌다.
 *
 * **시각을 만들어 내지 않는다** — `null` 이면 `null` 이다. 공유 열람에서 시간 열이
 * 비는 것이 "미정" 이고, `00:00` 으로 채우면 자정 출발로 읽힌다.
 */
export function planItemTimeLabel(startTime: string | null): string | null {
  if (startTime === null) return null

  const matched = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(startTime)
  if (matched === null) return null

  const [, hour, minute] = matched as unknown as [string, string, string]
  if (Number(hour) > 23 || Number(minute) > 59) return null

  return `${hour}:${minute}`
}
