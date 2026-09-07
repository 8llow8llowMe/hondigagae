import { describe, expect, it } from 'vitest'

import { pickUpcomingPlans } from '@/lib/plan/upcoming'
import { upcomingPlan } from '@/test/fixtures/insight'
import type { PlanSummaryItem } from '@/types/plan'

const TODAY = new Date('2026-09-07T12:00:00+09:00')

function plan(overrides: Partial<PlanSummaryItem>): PlanSummaryItem {
  return { ...upcomingPlan, ...overrides }
}

/*
  이 목록의 순서가 곧 `GET /plans` 의 순서다 — **최근 생성순(planId 내림차순)** 이라
  날짜와 아무 상관이 없다. mock fixture 가 실제로 이 모양이고, 그래서 홈이 첫 건을
  집었을 때 5개월 지난 일정이 "다가오는 일정" 으로 떴다.
*/
const AS_SERVER_RETURNS = [
  plan({ planId: '4', title: '애월 하루', startDate: '2026-04-11', endDate: '2026-04-11' }),
  plan({ planId: '3', title: '몽실이 첫 제주', startDate: '2026-05-02', endDate: '2026-05-04' }),
  plan({
    planId: '2',
    title: '초코와 가을 서귀포',
    startDate: '2026-10-03',
    endDate: '2026-10-04',
  }),
  plan({
    planId: '1',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
  }),
]

describe('pickUpcomingPlans', () => {
  it('지나간 일정을 다가오는 일정이라고 부르지 않는다', () => {
    const picked = pickUpcomingPlans(AS_SERVER_RETURNS, TODAY, 1)

    expect(picked.map((item) => item.title)).toEqual(['몽실이와 제주 2박 3일'])
  })

  it('응답 순서(최근 생성순)가 아니라 가까운 날짜순으로 고른다', () => {
    const picked = pickUpcomingPlans(AS_SERVER_RETURNS, TODAY, 2)

    expect(picked.map((item) => item.startDate)).toEqual(['2026-09-12', '2026-10-03'])
  })

  /*
    **지난 일정의 기준은 종료일이다.** 여행 중인 날에 그 일정을 지워 버리면, 사용자가
    홈에서 가장 보고 싶은 것이 사라진다.
  */
  it('오늘이 여행 기간 안이면 아직 지나간 일정이 아니다', () => {
    const ongoing = plan({ title: '여행 중', startDate: '2026-09-05', endDate: '2026-09-09' })

    const picked = pickUpcomingPlans([ongoing, ...AS_SERVER_RETURNS], TODAY, 1)

    expect(picked.map((item) => item.title)).toEqual(['여행 중'])
  })

  it('다가오는 일정이 하나도 없으면 빈 배열이다 — 지난 일정으로 채우지 않는다', () => {
    const past = AS_SERVER_RETURNS.slice(0, 2)

    expect(pickUpcomingPlans(past, TODAY, 1)).toEqual([])
  })

  /* 날짜를 못 읽는 값은 지난 쪽으로 밀지 않는다 — `isPastPlan` 과 같은 판단이다 */
  it('날짜를 읽을 수 없는 일정을 임의로 버리지 않는다', () => {
    const broken = plan({ title: '깨진 날짜', startDate: '알 수 없음', endDate: '알 수 없음' })

    expect(pickUpcomingPlans([broken], TODAY, 1)).toHaveLength(1)
  })

  it('원본 배열을 뒤집지 않는다', () => {
    const input = [...AS_SERVER_RETURNS]

    pickUpcomingPlans(input, TODAY, 4)

    expect(input.map((item) => item.planId)).toEqual(['4', '3', '2', '1'])
  })
})
