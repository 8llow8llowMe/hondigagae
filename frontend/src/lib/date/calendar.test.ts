import { describe, expect, it } from 'vitest'

import {
  CALENDAR_WEEKS,
  monthCells,
  monthLabel,
  shiftMonth,
  stepDay,
  yearMonthOf,
} from '@/lib/date/calendar'

describe('yearMonthOf', () => {
  it('날짜에서 연·월을 읽는다 — month 는 1부터다', () => {
    expect(yearMonthOf('2026-09-12')).toEqual({ year: 2026, month: 9 })
    expect(yearMonthOf('2026-01-01')).toEqual({ year: 2026, month: 1 })
    expect(yearMonthOf('2026-12-31')).toEqual({ year: 2026, month: 12 })
  })

  it('읽을 수 없으면 null 이다 — 호출부가 대체 달을 정한다', () => {
    expect(yearMonthOf('')).toBeNull()
    expect(yearMonthOf('2026-13-01')).toBeNull()
    expect(yearMonthOf('2026-02-31')).toBeNull()
  })
})

describe('shiftMonth', () => {
  it('해를 넘긴다', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('여러 달을 한 번에 옮긴다', () => {
    expect(shiftMonth({ year: 2026, month: 9 }, 5)).toEqual({ year: 2027, month: 2 })
  })
})

describe('monthLabel', () => {
  it('한국어 표기다', () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe('2026년 9월')
  })
})

describe('monthCells', () => {
  it('항상 6주를 그린다 — 달을 넘길 때 패널 높이가 들썩이지 않는다', () => {
    for (const month of [1, 2, 5, 9, 12]) {
      expect(monthCells({ year: 2026, month })).toHaveLength(CALENDAR_WEEKS * 7)
    }
  })

  it('일요일에서 시작한다', () => {
    // 2026-09-01 은 화요일이라 앞에 8월 30(일)·31(월) 두 칸이 붙는다
    const cells = monthCells({ year: 2026, month: 9 })

    expect(cells[0]).toEqual({ date: '2026-08-30', dayOfMonth: 30, inMonth: false })
    expect(cells[1]).toEqual({ date: '2026-08-31', dayOfMonth: 31, inMonth: false })
    expect(cells[2]).toEqual({ date: '2026-09-01', dayOfMonth: 1, inMonth: true })
  })

  it('1일이 일요일이면 앞 채움칸이 없다', () => {
    // 2026-02-01 은 일요일이다
    const cells = monthCells({ year: 2026, month: 2 })

    expect(cells[0]).toEqual({ date: '2026-02-01', dayOfMonth: 1, inMonth: true })
  })

  it('채움칸도 실제 날짜를 갖는다 — 눌러서 그 달로 넘어갈 수 있어야 한다', () => {
    const cells = monthCells({ year: 2026, month: 9 })
    const trailing = cells.filter((cell) => !cell.inMonth && cell.date > '2026-09-30')

    expect(trailing[0]?.date).toBe('2026-10-01')
    expect(trailing.every((cell) => /^\d{4}-\d{2}-\d{2}$/.test(cell.date))).toBe(true)
  })

  it('윤년 2월을 29일까지 센다', () => {
    const leap = monthCells({ year: 2028, month: 2 }).filter((cell) => cell.inMonth)
    const common = monthCells({ year: 2026, month: 2 }).filter((cell) => cell.inMonth)

    expect(leap).toHaveLength(29)
    expect(common).toHaveLength(28)
  })

  it('그 달의 날짜가 하루도 빠지지 않는다', () => {
    const cells = monthCells({ year: 2026, month: 1 }).filter((cell) => cell.inMonth)

    expect(cells[0]?.date).toBe('2026-01-01')
    expect(cells.at(-1)?.date).toBe('2026-01-31')
    expect(cells).toHaveLength(31)
  })
})

describe('stepDay', () => {
  it('좌우는 하루, 위아래는 한 주다', () => {
    expect(stepDay('2026-09-12', 'left')).toBe('2026-09-11')
    expect(stepDay('2026-09-12', 'right')).toBe('2026-09-13')
    expect(stepDay('2026-09-12', 'up')).toBe('2026-09-05')
    expect(stepDay('2026-09-12', 'down')).toBe('2026-09-19')
  })

  it('달·해 경계를 넘는다 — 격자 끝에서 막히지 않는다', () => {
    expect(stepDay('2026-09-30', 'right')).toBe('2026-10-01')
    expect(stepDay('2026-01-01', 'left')).toBe('2025-12-31')
    expect(stepDay('2026-12-28', 'down')).toBe('2027-01-04')
  })

  it('읽을 수 없는 값은 그대로 둔다', () => {
    expect(stepDay('', 'right')).toBe('')
  })
})
