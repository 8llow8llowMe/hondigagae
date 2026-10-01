import { describe, expect, it } from 'vitest'

import { dayToLocalNoon } from '@/lib/date/day'
import { pickHomePlans, pickTripBanner, TRIP_BANNER_DAYS } from '@/lib/plan/trip-banner'
import { upcomingPlan } from '@/test/fixtures/insight'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 홈 첫 화면 여행 배너가 고를 일정 (#1113 · 홈 명세 D5-1c).
 *
 * 오늘은 서버가 정한 `YYYY-MM-DD` 하나이고, 홈이 그것을 `dayToLocalNoon` 으로 바꿔
 * `planPhaseOf` 에 넘긴다 — 테스트도 같은 두 모양을 같은 날에서 만든다.
 */
function at(todayIso: string, plans: PlanSummaryItem[]) {
  return pickTripBanner(plans, dayToLocalNoon(todayIso) as Date, todayIso)
}

function plan(overrides: Partial<PlanSummaryItem>): PlanSummaryItem {
  return { ...upcomingPlan, ...overrides }
}

const TRIP = plan({ planId: 't', startDate: '2026-10-10', endDate: '2026-10-12' })

describe('pickTripBanner — 시점별 갈래', () => {
  it('출발 7일 전부터 D-N 이다', () => {
    expect(at('2026-10-03', [TRIP])).toEqual({ kind: 'SOON', plan: TRIP, days: 7 })
    expect(at('2026-10-08', [TRIP])).toEqual({ kind: 'SOON', plan: TRIP, days: 2 })
  })

  it('8일 전에는 서지 않는다', () => {
    expect(TRIP_BANNER_DAYS).toBe(7)
    expect(at('2026-10-02', [TRIP])).toBeNull()
  })

  /* 브리핑 배너(`pickBriefingDate`)와 같은 날에 전날 갈래가 된다 — 두 배너가 날을 달리 부르지 않는다 */
  it('출발 하루 전은 전날 브리핑이다', () => {
    expect(at('2026-10-09', [TRIP])).toEqual({ kind: 'EVE', plan: TRIP })
  })

  it('출발 당일은 1일차 브리핑이다 — planPhaseOf 의 D-DAY 를 1일차로 읽는다', () => {
    expect(at('2026-10-10', [TRIP])).toEqual({ kind: 'TODAY', plan: TRIP, day: 1 })
  })

  it('여행 중이면 며칠째인지를 싣는다', () => {
    expect(at('2026-10-11', [TRIP])).toEqual({ kind: 'TODAY', plan: TRIP, day: 2 })
    expect(at('2026-10-12', [TRIP])).toEqual({ kind: 'TODAY', plan: TRIP, day: 3 })
  })

  it('끝난 다음 날에는 서지 않는다', () => {
    expect(at('2026-10-13', [TRIP])).toBeNull()
  })

  it('하루짜리 일정도 당일은 1일차다', () => {
    const day = plan({ planId: 'd', startDate: '2026-10-10', endDate: '2026-10-10' })

    expect(at('2026-10-10', [day])).toEqual({ kind: 'TODAY', plan: day, day: 1 })
  })
})

describe('pickTripBanner — 어느 일정을 고르나', () => {
  it('일정이 없으면 서지 않는다', () => {
    expect(at('2026-10-05', [])).toBeNull()
  })

  /*
    `GET /plans` 는 최근 생성순이다 — 응답 순서를 믿으면 나중에 만든 먼 일정이 배너를 차지한다.
  */
  it('응답 순서가 아니라 출발일이 가까운 일정을 고른다', () => {
    const far = plan({ planId: 'far', startDate: '2026-10-09', endDate: '2026-10-09' })
    const near = plan({ planId: 'near', startDate: '2026-10-06', endDate: '2026-10-07' })

    expect(at('2026-10-04', [far, near])?.plan.planId).toBe('near')
  })

  it('여행 중인 일정이 곧 떠날 일정보다 먼저다', () => {
    const next = plan({ planId: 'next', startDate: '2026-10-12', endDate: '2026-10-13' })

    expect(at('2026-10-11', [next, TRIP])).toEqual({ kind: 'TODAY', plan: TRIP, day: 2 })
  })

  it('지난 일정은 고르지 않는다', () => {
    const past = plan({ planId: 'past', startDate: '2026-09-01', endDate: '2026-09-02' })

    expect(at('2026-10-05', [past, TRIP])).toEqual({ kind: 'SOON', plan: TRIP, days: 5 })
  })

  it('상태를 보지 않는다 — 날짜만 본다', () => {
    const done = plan({
      ...TRIP,
      status: { code: 'COMPLETED', name: '완료', description: null },
    })

    expect(at('2026-10-11', [done])?.kind).toBe('TODAY')
  })
})

describe('pickTripBanner — 기간이 성립하지 않는 일정', () => {
  /* 상세 브리핑(`pickBriefingDate`)이 거절하는 일정을 홈이 `D-N` 으로 부르지 않는다 */
  it('종료일이 시작일보다 앞서면 서지 않는다', () => {
    const reversed = plan({ planId: 'r', startDate: '2026-10-10', endDate: '2026-10-08' })

    expect(at('2026-10-05', [reversed])).toBeNull()
    expect(at('2026-10-08', [reversed])).toBeNull()
  })

  /* 문자열 정렬에서 깨진 시작일이 맨 앞에 와 정상 일정을 가리던 갈래 */
  it('날짜를 못 읽는 일정이 정상 일정을 가리지 않는다', () => {
    const broken = plan({ planId: 'b', startDate: '', endDate: '2026-10-11' })
    const loose = plan({ planId: 'l', startDate: '2026-1-5', endDate: '2026-1-6' })

    expect(at('2026-10-05', [broken, loose, TRIP])).toEqual({ kind: 'SOON', plan: TRIP, days: 5 })
  })
})

describe('pickHomePlans — 배너와 아래 섹션이 일정을 나눠 갖는다', () => {
  function home(todayIso: string, plans: PlanSummaryItem[]) {
    return pickHomePlans(plans, dayToLocalNoon(todayIso) as Date, todayIso, 1)
  }

  const NEXT = plan({ planId: 'n', startDate: '2026-10-20', endDate: '2026-10-21' })

  it('배너에 선 일정은 아래 섹션에서 빠지고 그다음 일정이 선다', () => {
    const result = home('2026-10-11', [NEXT, TRIP])

    expect(result.banner?.plan.planId).toBe('t')
    expect(result.upcoming.map((item) => item.planId)).toEqual(['n'])
    expect(result.sectionShown).toBe(true)
  })

  it('배너가 유일한 다가오는 일정을 가져가면 섹션째 숨는다', () => {
    const past = plan({ planId: 'p', startDate: '2026-09-01', endDate: '2026-09-02' })
    const result = home('2026-10-11', [past, TRIP])

    expect(result.upcoming).toEqual([])
    expect(result.sectionShown).toBe(false)
  })

  /* 배너가 없는 날의 빈 상태(일정 없음 · 전부 지남)는 섹션이 그대로 말한다 */
  it('배너가 없으면 섹션은 늘 선다 — 비어 있어도 빈 상태를 그린다', () => {
    expect(home('2026-10-11', []).sectionShown).toBe(true)
    expect(home('2026-09-20', [NEXT])).toMatchObject({ banner: null, sectionShown: true })
    expect(home('2026-09-20', [NEXT]).upcoming.map((item) => item.planId)).toEqual(['n'])
  })

  /* 여행 중인 일정이 둘 겹치면 남은 하나도 여행 중이라 섹션 제목(`진행 중인 일정`)이 맞는다 */
  it('여행 중 일정이 겹치면 나머지 하나가 섹션에 남는다', () => {
    const overlap = plan({ planId: 'o', startDate: '2026-10-11', endDate: '2026-10-13' })
    const result = home('2026-10-11', [overlap, TRIP])

    expect(result.banner?.plan.planId).toBe('t')
    expect(result.upcoming.map((item) => item.planId)).toEqual(['o'])
  })
})
