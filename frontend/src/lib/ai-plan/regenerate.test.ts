import { describe, expect, it } from 'vitest'

import { toDayRegeneratePayload } from '@/lib/ai-plan/regenerate'
import type { PlanDetail } from '@/types/plan'

function plan(overrides: Partial<PlanDetail> = {}): PlanDetail {
  return {
    planId: '223456789012000001',
    petId: '123456789012000001',
    petIds: ['123456789012000001', '123456789012000002'],
    areaCode: '39',
    sigunguCode: '4',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    budget: 400000,
    status: { code: 'DRAFT', name: '초안', description: null },
    totalDays: 3,
    items: [],
    ...overrides,
  }
}

describe('toDayRegeneratePayload', () => {
  it('일정에서 지역·기간·반려견을 그대로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan(), 2, '')

    expect(payload.areaCode).toBe('39')
    expect(payload.startDate).toBe('2026-09-12')
    expect(payload.endDate).toBe('2026-09-14')
    expect(payload.petIds).toEqual(['123456789012000001', '123456789012000002'])
  })

  it('planId 와 regenerateDay 를 짝으로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan(), 2, '')

    expect(payload.planId).toBe('223456789012000001')
    expect(payload.regenerateDay).toBe(2)
  })

  /*
    Snowflake 다. `Number()` 를 거치면 정밀도를 잃는다 — `submit.ts` 의 pinnedPlaceIds 와
    같은 판단이다.
  */
  it('planId 를 숫자로 바꾸지 않는다', () => {
    expect(typeof toDayRegeneratePayload(plan(), 1, '').planId).toBe('string')
  })

  it('예산이 없으면 키 자체를 넣지 않는다 — @Positive 다', () => {
    expect('budget' in toDayRegeneratePayload(plan({ budget: null }), 1, '')).toBe(false)
  })

  it('예산이 0 이하면 키를 넣지 않는다', () => {
    expect('budget' in toDayRegeneratePayload(plan({ budget: 0 }), 1, '')).toBe(false)
  })

  it('예산이 있으면 원 단위 그대로 싣는다', () => {
    expect(toDayRegeneratePayload(plan(), 1, '').budget).toBe(400000)
  })

  it('메모가 비면 키를 넣지 않는다', () => {
    expect('requestNote' in toDayRegeneratePayload(plan(), 1, '   ')).toBe(false)
  })

  it('메모는 trim 해서 싣는다', () => {
    expect(toDayRegeneratePayload(plan(), 1, '  실내 위주로  ').requestNote).toBe('실내 위주로')
  })

  /*
    R3-1. 일정에 저장되지 않는 값이라 되살릴 근거가 없다. 특히 pinnedPlaceIds 는
    "반드시 배치" 약속이라 잘못 실으면 요구한 적 없는 장소가 그 날에 박힌다.
  */
  it('preferFavorites·pinnedPlaceIds 를 지어내지 않는다', () => {
    const payload = toDayRegeneratePayload(plan(), 1, '메모')

    expect('preferFavorites' in payload).toBe(false)
    expect('pinnedPlaceIds' in payload).toBe(false)
  })

  it('한 마리 일정도 petIds 원소 하나로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan({ petIds: ['123456789012000001'] }), 1, '')

    expect(payload.petIds).toEqual(['123456789012000001'])
  })
})
