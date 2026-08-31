import { describe, expect, it } from 'vitest'

import { totalDaysBetween } from '@/lib/plan/date'

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
