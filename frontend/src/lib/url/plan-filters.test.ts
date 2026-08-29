import { describe, expect, it } from 'vitest'

import { parsePlanFilters, toPlanFilterQuery } from '@/lib/url/plan-filters'
import { DEFAULT_PLAN_FILTERS, type PlanFilters } from '@/types/plan'

describe('일정 필터 URL 직렬화', () => {
  it('기본 상태는 URL 에서 생략한다 — 빈 URL = 기본 상태', () => {
    expect(toPlanFilterQuery(DEFAULT_PLAN_FILTERS)).toBe('')
  })

  it('배열은 콤마 구분 단일 키다 — 반복 키를 쓰지 않는다', () => {
    expect(toPlanFilterQuery({ status: 'ALL', petIds: ['1', '2'] })).toBe('petId=1%2C2')
  })

  it('없는 상태 코드는 예외 대신 기본값으로 떨어진다 — URL 은 사용자가 손으로 고친다', () => {
    expect(parsePlanFilters({ status: 'ARCHIVED' }).status).toBe('ALL')
  })

  it('빈 조각과 중복 petId 를 걸러 낸다', () => {
    expect(parsePlanFilters({ petId: ',1, 2,1,' }).petIds).toEqual(['1', '2'])
  })

  it('반복 키로 들어오면 첫 값만 쓴다', () => {
    expect(parsePlanFilters({ petId: ['1', '2'] }).petIds).toEqual(['1'])
  })

  const CASES: PlanFilters[] = [
    DEFAULT_PLAN_FILTERS,
    { status: 'DRAFT', petIds: [] },
    { status: 'ALL', petIds: ['1234567890123456789'] },
    { status: 'COMPLETED', petIds: ['1', '2'] },
  ]

  it.each(CASES)('round-trip: parse(toQuery(f)) === f — %o', (filters) => {
    expect(parsePlanFilters(new URLSearchParams(toPlanFilterQuery(filters)))).toEqual(filters)
  })
})
