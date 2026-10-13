import { afterEach, describe, expect, it } from 'vitest'

import {
  isDayBefore,
  isDayWithin,
  parseDay,
  serviceTodayDay,
  todayDay,
  todayFromDay,
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
  /*
    **#1396.** 만들기 화면이 오늘을 `toISOString().slice(0, 10)`(UTC)으로 만들어 KST 오전 9시 전에는
    어제가 달력의 최소일이 됐다. 서울 시간대 프로세스(운영 컨테이너 `TZ: ${TIME_ZONE}` · 로컬)에서
    `todayDay` 는 그 시각에도 오늘이다. Node 는 `process.env.TZ` 를 바꾸면 바로 반영한다.
  */
  describe('서울 시간대 오전 9시 전 (#1396)', () => {
    const originalTz = process.env.TZ
    afterEach(() => {
      process.env.TZ = originalTz
    })

    it('todayDay 는 오늘이고, toISOString 으로 자르면 어제다', () => {
      process.env.TZ = 'Asia/Seoul'
      const earlyMorning = new Date('2026-10-12T08:30:00+09:00')

      expect(todayDay(earlyMorning)).toBe('2026-10-12')
      // 예전 두 만들기 화면의 계산 — 이 값이 달력의 min 이 되어 어제가 열렸다
      expect(earlyMorning.toISOString().slice(0, 10)).toBe('2026-10-11')
    })
  })
})

/*
  **#1490.** 판정 함수(`planPhaseOf` · `tripPhaseOf` …)는 `todayUtc()` 로 **로컬 getter** 를 읽는다.
  그래서 서버가 만든 시각(instant)을 브라우저로 넘기면 브라우저 시간대가 날짜를 다시 정한다.
  서버가 정한 달력의 칸을 넘기고 브라우저에서 로컬 정오로 세우면, 어느 시간대에서 읽어도 같은 칸이다.

  시간대는 `process.env.TZ` 를 테스트 안에서 바꿔 고정한다 (위 #1396 과 같은 방식 — Node 는 바로
  반영한다). `TZ=UTC pnpm test` 같은 실행 옵션에 기대면 기본 실행(`pnpm verify` · CI)에서는 그 갈래가
  돌지 않는다.
*/
describe('todayFromDay (#1490)', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  // UTC-12 ~ UTC+14 양 끝과 운영(서울) · 브라우저 기본값(UTC)
  const ZONES = ['UTC', 'Asia/Seoul', 'America/Los_Angeles', 'Etc/GMT+12', 'Pacific/Kiritimati']

  it.each(ZONES)('%s 에서 읽어도 서버가 정한 칸 그대로다', (zone) => {
    process.env.TZ = zone
    const today = todayFromDay('2026-10-15')

    expect(todayDay(today)).toBe('2026-10-15')
    expect(today.getDate()).toBe(15)
  })

  it('형식이 깨진 값은 던진다 — new Date() 로 메우면 #1490 이 조용히 돌아온다', () => {
    expect(() => todayFromDay('2026-02-31')).toThrow()
    expect(() => todayFromDay('2026-10-14T18:00:00.000Z')).toThrow()
  })
})

/*
  **#1499.** 담기 시트는 서버가 그린 적 없는 트리라 오늘을 브라우저에서 만든다. `todayDay(new Date())`
  는 **브라우저 시간대**의 칸이라, 브라우저가 UTC 이고 KST 00–09시면 하루 이르다 — KST 기준 어제가
  출발일 하한이 됐다. 서비스의 오늘(백엔드 `Clock` · 운영 컨테이너 `TZ`)은 서울 기준이므로,
  클라이언트도 실행 환경 시간대와 무관하게 서울의 칸을 읽는다. 시간대는 위 #1490 과 같이 테스트
  안에서 `process.env.TZ` 로 고정한다.
*/
describe('serviceTodayDay (#1499)', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  it('UTC 실행 환경에서 KST 새벽이면 KST 날짜다 — todayDay 는 하루 이르다', () => {
    process.env.TZ = 'UTC'
    const kstEarlyMorning = new Date('2026-10-15T08:30:00+09:00')

    expect(serviceTodayDay(kstEarlyMorning)).toBe('2026-10-15')
    // 예전 시트의 계산 — 브라우저 시간대(UTC)의 칸이라 KST 기준 어제다
    expect(todayDay(kstEarlyMorning)).toBe('2026-10-14')
  })

  // UTC-12 ~ UTC+14 양 끝과 운영(서울) · 브라우저 기본값(UTC)
  const ZONES = ['UTC', 'Asia/Seoul', 'America/Los_Angeles', 'Etc/GMT+12', 'Pacific/Kiritimati']

  it.each(ZONES)('%s 에서 읽어도 서울의 칸이다 — 자정 직후 · 직전 모두', (zone) => {
    process.env.TZ = zone

    expect(serviceTodayDay(new Date('2026-10-15T00:00:00+09:00'))).toBe('2026-10-15')
    expect(serviceTodayDay(new Date('2026-10-15T23:59:59+09:00'))).toBe('2026-10-15')
    expect(serviceTodayDay(new Date('2026-12-31T23:59:59+09:00'))).toBe('2026-12-31')
    expect(serviceTodayDay(new Date('2027-01-01T00:00:00+09:00'))).toBe('2027-01-01')
  })

  it('서울 시간대 프로세스(운영 서버)에서는 todayDay 와 같다 — 서버 페이지가 내린 오늘과 갈리지 않는다', () => {
    process.env.TZ = 'Asia/Seoul'
    const instants = [
      '2026-10-15T00:00:00+09:00',
      '2026-10-15T08:59:59+09:00',
      '2026-10-15T23:59:59+09:00',
    ]

    for (const instant of instants) {
      const now = new Date(instant)
      expect(serviceTodayDay(now)).toBe(todayDay(now))
    }
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
