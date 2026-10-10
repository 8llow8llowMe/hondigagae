import { describe, expect, it } from 'vitest'

import {
  formatPlanDateRange,
  formatPlanDateRangeCompact,
  planItemTimeLabel,
  totalDaysBetween,
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
