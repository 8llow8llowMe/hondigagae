import { parseDay, toDayString } from '@/lib/date/day'

/**
 * 달 격자 계산 — `Calendar` 컴포넌트가 그릴 42칸을 만든다.
 *
 * **표시와 계산을 나눈다.** 격자 계산은 순수 함수라 node 환경에서 그대로 단위 테스트가
 * 되고(윤년 · 월 경계 · 주 시작), 컴포넌트는 그 결과를 그리기만 한다.
 */

/** `month` 는 1–12 다. `Date` 의 0–11 을 밖으로 흘리지 않는다 — 한 번은 반드시 틀린다 */
export type YearMonth = { year: number; month: number }

export type CalendarCell = {
  /** `'YYYY-MM-DD'` */
  date: string
  dayOfMonth: number
  /** 이 달의 날짜인가. `false` 면 앞·뒤 달에서 끌어온 채움칸이다 */
  inMonth: boolean
}

/** 항상 6주를 그린다. 주 수가 달마다 바뀌면 달을 넘길 때 패널 높이가 들썩인다 */
export const CALENDAR_WEEKS = 6

export function yearMonthOf(date: string): YearMonth | null {
  const time = parseDay(date)
  if (time === null) return null

  const parsed = new Date(time)
  return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1 }
}

/** 달을 옮긴다. 12월 → 1월의 해 넘김을 `Date.UTC` 가 알아서 처리한다 */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const moved = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1 }
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${year}년 ${month}월`
}

/**
 * 6주 × 7일 = 42칸. **일요일 시작**이다 (`WEEKDAYS` 의 순서와 같다).
 *
 * 1일이 무슨 요일인지에 맞춰 앞달에서 끌어오고, 42칸이 찰 때까지 뒷달로 넘어간다.
 * 채움칸도 실제 날짜를 갖는다 — 눌러서 그 달로 넘어갈 수 있어야 한다.
 */
export function monthCells(ym: YearMonth): CalendarCell[] {
  const firstOfMonth = Date.UTC(ym.year, ym.month - 1, 1)
  const leading = new Date(firstOfMonth).getUTCDay()
  const gridStart = firstOfMonth - leading * 86_400_000

  return Array.from({ length: CALENDAR_WEEKS * 7 }, (_, index) => {
    const time = gridStart + index * 86_400_000
    const cell = new Date(time)

    return {
      date: toDayString(time),
      dayOfMonth: cell.getUTCDate(),
      inMonth: cell.getUTCFullYear() === ym.year && cell.getUTCMonth() === ym.month - 1,
    }
  })
}

/** 격자 안에서 방향키가 옮길 칸 수. 좌우 1일, 위아래 한 주 */
export const CALENDAR_STEP = { left: -1, right: 1, up: -7, down: 7 } as const

export type CalendarDirection = keyof typeof CALENDAR_STEP

/** 방향키 이동 결과. 달을 벗어나면 그 달로 넘어간다 — 격자 끝에서 막히지 않는다 */
export function stepDay(date: string, direction: CalendarDirection): string {
  const time = parseDay(date)
  if (time === null) return date

  return toDayString(time + CALENDAR_STEP[direction] * 86_400_000)
}
