import { describe, expect, it } from 'vitest'

import { countByPet, countByStatus, filterPlans } from '@/lib/plan/list'
import { DEFAULT_PLAN_FILTERS, type PlanFilters, type PlanSummaryItem } from '@/types/plan'

/**
 * 개수를 말할 수 있는가 — `PlanListView` 의 `countable` 판정과 두 축의 교차 집계.
 *
 * **조건이 둘이다.** `hasNext` 는 "더 있는데 안 받았다", `pages === undefined` 는
 * "아직 한 장도 못 받았다". 후자를 빼먹으면 조회 중에 `일정 0개` 가 뜬다 (375 실렌더).
 */
function countable(pages: unknown[] | undefined, hasNext: boolean): boolean {
  return pages !== undefined && !hasNext
}

function plan(petId: string, status: string): PlanSummaryItem {
  return {
    planId: `p-${petId}-${status}`,
    petId,
    petIds: [petId],
    areaCode: '39',
    title: '일정',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    status: { code: status, name: status, description: null },
  }
}

describe('개수를 말할 수 있는 조건', () => {
  it('아직 한 장도 못 받았으면 셀 수 없다 — 조회 중과 실패가 여기에 걸린다', () => {
    expect(countable(undefined, false)).toBe(false)
  })

  it('더 받을 것이 남아 있으면 셀 수 없다', () => {
    expect(countable([{}], true)).toBe(false)
  })

  it('전량을 받았을 때만 센다', () => {
    expect(countable([{}], false)).toBe(true)
  })

  it('빈 목록도 전량이면 0 이라고 말할 수 있다', () => {
    expect(countable([], false)).toBe(true)
  })
})

describe('두 축은 서로를 기준으로 센다 (아트보드 04 주석)', () => {
  const PLANS = [plan('mong', 'DRAFT'), plan('mong', 'COMPLETED'), plan('choco', 'CONFIRMED')]

  it('상태 개수는 반려견 필터를 적용한 뒤 값이다 — 몽실이 선택 시 확정 0', () => {
    const filters: PlanFilters = { status: 'CONFIRMED', petIds: ['mong'] }
    const counts = countByStatus(
      filterPlans(PLANS, { ...DEFAULT_PLAN_FILTERS, petIds: filters.petIds }),
    )

    expect(counts.CONFIRMED).toBe(0)
    expect(counts.DRAFT).toBe(1)
    // 0 을 감추지 않는다
    expect(counts).toHaveProperty('CONFIRMED', 0)
  })

  it('반려견 개수는 상태 필터를 적용한 뒤 값이다', () => {
    const filters: PlanFilters = { status: 'DRAFT', petIds: [] }
    const counts = countByPet(
      filterPlans(PLANS, { ...DEFAULT_PLAN_FILTERS, status: filters.status }),
    )

    expect(counts.get('mong')).toBe(1)
    expect(counts.get('choco')).toBeUndefined()
  })
})

/*
  **일정이 하나도 없으면 모바일 좁히기 도구를 세우지 않는다** (#913). 빈 계정 390 에서
  `전체 0 · 초안 0 · 확정 0 · 완료 0` 이 빈 상태 위에 섰다. `PlanListView` 는 훅을 부르는
  client component 라 렌더할 수 없어 소스로 조건의 **자리**를 잠근다 — 조건이 `countable`
  을 빼면 첫 페이지가 오는 순간 탭 줄이 끼어든다.
*/
describe('PlanListView — 0건이면 모바일 탭을 숨긴다 (#913)', () => {
  it('모바일 탭 묶음이 countable && 0건 조건 안에 있다', async () => {
    const { readSourceWithoutComments } = await import('@/test/source')
    const view = readSourceWithoutComments('src/features/plan/plan-list-view.tsx')
    const guard = view.indexOf('{!(countable && allPlans.length === 0) && (')
    const tabs = view.indexOf('<div className="lg:hidden">')

    expect(guard).toBeGreaterThan(-1)
    expect(tabs).toBeGreaterThan(guard)
    // 가드와 탭 묶음 사이에 다른 요소가 끼지 않는다
    expect(view.slice(guard, tabs)).not.toMatch(/<[A-Za-z]/)
  })
})
