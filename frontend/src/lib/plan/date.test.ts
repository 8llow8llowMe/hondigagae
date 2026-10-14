import { afterEach, describe, expect, it } from 'vitest'

import { serviceTodayDay, todayFromDay } from '@/lib/date/day'
import {
  formatPlanDateRange,
  formatPlanDateRangeCompact,
  planItemTimeLabel,
  planPhaseOf,
  totalDaysBetween,
  tripPhaseOf,
} from '@/lib/plan/date'

describe('totalDaysBetween — 담기 전에는 서버가 totalDays 를 주지 않는다', () => {
  it('양끝을 포함해 센다', () => {
    expect(totalDaysBetween('2026-09-12', '2026-09-14')).toBe(3)
  })

  it('하루짜리는 1일이다', () => {
    expect(totalDaysBetween('2026-09-12', '2026-09-12')).toBe(1)
  })

  it('달을 넘겨도 센다', () => {
    expect(totalDaysBetween('2026-08-30', '2026-09-02')).toBe(4)
  })

  it('해를 넘겨도 센다', () => {
    expect(totalDaysBetween('2026-12-30', '2027-01-02')).toBe(4)
  })

  it('역전이면 null 이다 — 일수를 지어내지 않는다', () => {
    expect(totalDaysBetween('2026-09-14', '2026-09-12')).toBeNull()
  })

  it('서식이 어긋나면 null 이다', () => {
    expect(totalDaysBetween('2026/09/12', '2026-09-14')).toBeNull()
    expect(totalDaysBetween('', '')).toBeNull()
  })

  it('존재하지 않는 날짜는 null 이다 — Date.UTC 가 다음 달로 넘겨 버린다', () => {
    expect(totalDaysBetween('2026-02-31', '2026-03-02')).toBeNull()
  })
})

/**
 * 항목 시작 시각 표기 (#628 공유 열람 · #623 도 같은 값을 쓴다).
 *
 * **서버가 초까지 주는 것을 화면이 버린다는 계약**이라 값으로 잠근다 — 렌더 테스트는
 * `10:30` 이 보이는 것만 보고 `10:30:00` 이 새는 것을 못 잡는다.
 */
describe('항목 시작 시각 (planItemTimeLabel)', () => {
  it('초를 버린다', () => {
    expect(planItemTimeLabel('10:30:00')).toBe('10:30')
  })

  it('초가 없는 값도 읽는다', () => {
    expect(planItemTimeLabel('09:05')).toBe('09:05')
  })

  it('시각이 없으면 만들어 내지 않는다 — 00:00 으로 채우지 않는다', () => {
    expect(planItemTimeLabel(null)).toBeNull()
  })

  it('범위를 벗어난 값은 읽지 않는다', () => {
    expect(planItemTimeLabel('24:00:00')).toBeNull()
    expect(planItemTimeLabel('10:75:00')).toBeNull()
  })

  it('모양이 다르면 읽지 않는다', () => {
    expect(planItemTimeLabel('오전 10시')).toBeNull()
    expect(planItemTimeLabel('')).toBeNull()
  })
})

const TODAY = new Date('2026-09-22T00:00:00+09:00')

describe('formatPlanDateRangeCompact — 올해 일정은 연도를 뗀다 (#841)', () => {
  it('올해 일정이면 연도가 없다', () => {
    expect(formatPlanDateRangeCompact('2026-09-25', '2026-09-27', TODAY)).toBe(
      '9월 25일 (금) – 9월 27일 (일)',
    )
  })

  it('하루짜리도 연도가 없다', () => {
    expect(formatPlanDateRangeCompact('2026-09-25', '2026-09-25', TODAY)).toBe('9월 25일 (금)')
  })

  /* 내년 일정에서 연도를 떼면 언제인지 알 수 없어진다 */
  it('다른 해가 끼면 기존 형식 그대로다', () => {
    expect(formatPlanDateRangeCompact('2026-12-30', '2027-01-02', TODAY)).toBe(
      formatPlanDateRange('2026-12-30', '2027-01-02'),
    )
    expect(formatPlanDateRangeCompact('2027-03-01', '2027-03-03', TODAY)).toBe(
      formatPlanDateRange('2027-03-01', '2027-03-03'),
    )
  })

  /* 읽을 수 없는 날짜는 기존 함수의 폴백(입력 문자열)을 그대로 쓴다 */
  it('형식이 깨진 날짜는 기존 함수에 맡긴다', () => {
    expect(formatPlanDateRangeCompact('깨짐', '2026-09-27', TODAY)).toBe(
      formatPlanDateRange('깨짐', '2026-09-27'),
    )
  })
})

/*
  목록 표기의 시점 (#1433). 오늘(10/13) 시작한 10/13–15 여행이 `D-DAY` 로 서던 것을
  `여행 중 · 1일차` 로 읽게 한다 — 홈 배너(`pickTripBanner` 의 `TODAY`)가 그날을 1일차로
  부르는 것과 같은 셈이다. 판정 축(`planPhaseOf`)은 그대로 둔다.
*/
describe('tripPhaseOf — 목록은 출발 당일부터 여행 중이다 (#1433)', () => {
  const OCT_13 = new Date(2026, 9, 13)

  it('시작일 당일은 여행 중 1일차다', () => {
    expect(tripPhaseOf('2026-10-13', '2026-10-15', OCT_13)).toEqual({ kind: 'ongoing', day: 1 })
  })

  it('중간일은 며칠째인지 센다', () => {
    expect(tripPhaseOf('2026-10-12', '2026-10-15', OCT_13)).toEqual({ kind: 'ongoing', day: 2 })
  })

  it('종료일 당일도 여행 중이다 — 마지막 날이 N일차다', () => {
    expect(tripPhaseOf('2026-10-11', '2026-10-13', OCT_13)).toEqual({ kind: 'ongoing', day: 3 })
  })

  it('종료일 다음 날부터는 지난 일정이다', () => {
    expect(tripPhaseOf('2026-10-10', '2026-10-12', OCT_13)).toEqual({ kind: 'past' })
  })

  it('하루짜리 당일치기도 그날은 여행 중 1일차다', () => {
    expect(tripPhaseOf('2026-10-13', '2026-10-13', OCT_13)).toEqual({ kind: 'ongoing', day: 1 })
  })

  it('출발 전은 남은 일수 그대로다', () => {
    expect(tripPhaseOf('2026-10-14', '2026-10-16', OCT_13)).toEqual({ kind: 'upcoming', days: 1 })
  })

  it('날짜를 못 읽으면 null 이다', () => {
    expect(tripPhaseOf('2026-13-01', '2026-10-16', OCT_13)).toBeNull()
  })

  /* 버튼·토글·준비물 자리는 여전히 출발 당일을 `upcoming` 으로 본다 — 판정 축은 바꾸지 않는다 */
  it('planPhaseOf 는 출발 당일을 여전히 D-DAY(upcoming 0)로 둔다', () => {
    expect(planPhaseOf('2026-10-13', '2026-10-15', OCT_13)).toEqual({ kind: 'upcoming', days: 0 })
  })
})

/*
  **#1490.** 홈 · 목록 · 상세가 같은 `tripPhaseOf` 를 쓰면서 넘기는 `today` 의 모양이 달랐다.
  홈은 서버가 정한 칸의 로컬 정오, 목록 · 상세는 서버가 만든 시각(instant)이었다. 판정 함수는
  로컬 getter 로 날짜를 읽으므로, 브라우저가 UTC 이고 KST 00–09시면 시각 쪽만 하루 전으로 읽혔다.
  시간대는 `process.env.TZ` 를 테스트 안에서 바꿔 고정한다 (`lib/date/day.test.ts` 와 같은 방식).
*/
describe('tripPhaseOf — 브라우저 시간대가 서버와 달라도 출발 당일이다 (#1490)', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  // KST 10/15 03:00 — 서울 서버에게는 출발 당일, UTC 로는 아직 10/14 다
  const SERVER_NOW = new Date('2026-10-15T03:00:00+09:00')

  it('서버가 정한 칸을 로컬 정오로 세우면 UTC 브라우저에서도 오늘 1일차다', () => {
    // 서버 페이지는 서울의 칸을 만든다 (#1507) — 컨테이너가 UTC 여도 출발 당일이다
    process.env.TZ = 'UTC'
    const todayIso = serviceTodayDay(SERVER_NOW)
    expect(todayIso).toBe('2026-10-15')

    process.env.TZ = 'UTC'
    expect(tripPhaseOf('2026-10-15', '2026-10-17', todayFromDay(todayIso))).toEqual({
      kind: 'ongoing',
      day: 1,
    })
  })

  it('시각을 그대로 넘기면 UTC 브라우저는 D-1 로 읽는다 — 고치기 전 목록 · 상세의 모양', () => {
    process.env.TZ = 'UTC'
    expect(tripPhaseOf('2026-10-15', '2026-10-17', new Date(SERVER_NOW.toISOString()))).toEqual({
      kind: 'upcoming',
      days: 1,
    })
  })
})
