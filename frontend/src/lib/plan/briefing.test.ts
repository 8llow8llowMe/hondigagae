import { describe, expect, it } from 'vitest'

import { pickBriefingDate } from '@/lib/plan/briefing'

/**
 * 출발 전 여행 브리핑의 날짜 선택 (#626 · 명세 D3-1).
 *
 * **`date` 는 필수 쿼리 파라미터고 기간 밖이면 400(`PLAN_002`) 이다.** 그래서 부를 날짜를
 * 화면이 정하고, 정할 수 없으면 `null` — 요청 자체를 하지 않는다.
 */
const START = '2026-09-12'
const END = '2026-09-14'

describe('pickBriefingDate — 규칙표 (명세 D3-1)', () => {
  it('출발 하루 전이면 시작일을 본다', () => {
    expect(pickBriefingDate(START, END, '2026-09-11')).toEqual({ kind: 'EVE', date: START })
  })

  it('출발 당일이면 오늘을 본다', () => {
    expect(pickBriefingDate(START, END, START)).toEqual({ kind: 'TODAY', date: START })
  })

  /*
    **3번 규칙이 4번보다 먼저다.** 여행 2일차 아침에 여는 사람에게 1일차 브리핑을 주면
    안 된다 — `planPhaseOf` 를 쓰지 않는 이유도 같다 (저쪽은 출발 당일을 `upcoming` 에
    남기는 축이라 여기서 쓰면 당일이 "아직 안 갔다" 쪽으로 떨어진다).
  */
  it('여행 중이면 오늘을 본다', () => {
    expect(pickBriefingDate(START, END, '2026-09-13')).toEqual({
      kind: 'TODAY',
      date: '2026-09-13',
    })
  })

  it('마지막 날도 여행 기간 안이다', () => {
    expect(pickBriefingDate(START, END, END)).toEqual({ kind: 'TODAY', date: END })
  })

  it('종료 다음 날이면 부를 날짜가 없다', () => {
    expect(pickBriefingDate(START, END, '2026-09-15')).toBeNull()
  })

  it('출발 이틀 전이면 부를 날짜가 없다', () => {
    expect(pickBriefingDate(START, END, '2026-09-10')).toBeNull()
  })

  it('하루짜리 일정도 전날이면 시작일을 본다', () => {
    expect(pickBriefingDate('2026-09-12', '2026-09-12', '2026-09-11')).toEqual({
      kind: 'EVE',
      date: '2026-09-12',
    })
  })

  // 월 경계를 `Date` 로 빼면 로컬 타임존에서 하루 밀린다 — `addPlanDays` 를 쓰는 근거
  it('월 경계를 넘는 전날도 시작일을 본다', () => {
    expect(pickBriefingDate('2026-10-01', '2026-10-02', '2026-09-30')).toEqual({
      kind: 'EVE',
      date: '2026-10-01',
    })
  })

  it('기간이 역전된 깨진 데이터는 부르지 않는다', () => {
    expect(pickBriefingDate('2026-09-14', '2026-09-12', '2026-09-13')).toBeNull()
  })

  it('못 읽는 날짜는 부르지 않는다', () => {
    expect(pickBriefingDate('2026-13-40', END, '2026-09-13')).toBeNull()
    expect(pickBriefingDate(START, '오늘', '2026-09-13')).toBeNull()
    expect(pickBriefingDate(START, END, '')).toBeNull()
  })
})

/**
 * **`TZ` 를 바꿔도 같은 답이어야 한다.** 이 함수가 `Date` 로 로컬 산술을 하지 않는다는 단언이다
 * (`lib/date/day.ts` 의 UTC 규칙).
 */
describe('pickBriefingDate — 타임존에 흔들리지 않는다', () => {
  it('프로세스 타임존을 바꿔도 같은 결과다', () => {
    const before = process.env.TZ

    try {
      process.env.TZ = 'UTC'
      const utc = pickBriefingDate('2026-10-01', '2026-10-02', '2026-09-30')
      process.env.TZ = 'Pacific/Kiritimati'
      const ahead = pickBriefingDate('2026-10-01', '2026-10-02', '2026-09-30')

      expect(utc).toEqual({ kind: 'EVE', date: '2026-10-01' })
      expect(ahead).toEqual(utc)
    } finally {
      process.env.TZ = before
    }
  })
})
