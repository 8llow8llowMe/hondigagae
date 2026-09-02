import { describe, expect, it } from 'vitest'

import {
  isDayBefore,
  isDayWithin,
  parseDay,
  todayDay,
  toDayString,
  weekdayOf,
} from '@/lib/date/day'

describe('parseDay', () => {
  it('UTC 자정으로 읽는다 — 타임존에 따라 요일이 밀리지 않는다', () => {
    expect(parseDay('2026-09-12')).toBe(Date.UTC(2026, 8, 12))
  })

  it('존재하지 않는 날짜를 거부한다 — Date.UTC 는 3월로 넘겨 버린다', () => {
    expect(parseDay('2026-02-31')).toBeNull()
    expect(parseDay('2026-13-01')).toBeNull()
    expect(parseDay('2026-9-1')).toBeNull()
    expect(parseDay('')).toBeNull()
  })
})

describe('toDayString / todayDay', () => {
  it('왕복해도 같은 값이다', () => {
    const time = parseDay('2026-09-12')
    expect(time).not.toBeNull()
    expect(toDayString(time as number)).toBe('2026-09-12')
  })

  it('오늘을 로컬 달력 기준으로 읽는다 — 로컬 9월 2일은 9월 2일이다', () => {
    expect(todayDay(new Date(2026, 8, 2, 23, 30))).toBe('2026-09-02')
    expect(todayDay(new Date(2026, 8, 2, 0, 30))).toBe('2026-09-02')
  })
})

describe('weekdayOf', () => {
  it('요일을 한국어로 준다', () => {
    expect(weekdayOf('2026-09-12')).toBe('토')
    expect(weekdayOf('2026-09-13')).toBe('일')
  })

  it('읽을 수 없으면 null 이다', () => {
    expect(weekdayOf('2026-02-31')).toBeNull()
  })
})

describe('isDayBefore', () => {
  it('시간순으로 비교한다', () => {
    expect(isDayBefore('2026-09-11', '2026-09-12')).toBe(true)
    expect(isDayBefore('2026-09-12', '2026-09-12')).toBe(false)
    expect(isDayBefore('2026-12-31', '2027-01-01')).toBe(true)
  })

  it('형식이 아닌 값은 비교하지 않는다 — 조용히 참이 되면 검증이 무력해진다', () => {
    expect(isDayBefore('', '2026-09-12')).toBe(false)
    expect(isDayBefore('2026-09-12', 'tomorrow')).toBe(false)
  })
})

describe('isDayWithin', () => {
  it('경계를 포함한다', () => {
    expect(isDayWithin('2026-09-10', '2026-09-10', '2026-09-12')).toBe(true)
    expect(isDayWithin('2026-09-12', '2026-09-10', '2026-09-12')).toBe(true)
  })

  it('밖이면 거짓이다', () => {
    expect(isDayWithin('2026-09-09', '2026-09-10', null)).toBe(false)
    expect(isDayWithin('2026-09-13', null, '2026-09-12')).toBe(false)
  })

  it('빈 경계는 제한 없음이다', () => {
    expect(isDayWithin('1999-01-01', null, null)).toBe(true)
  })

  it('읽을 수 없는 날짜는 고를 수 없다', () => {
    expect(isDayWithin('2026-02-31', null, null)).toBe(false)
  })
})
