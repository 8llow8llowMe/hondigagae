import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { mockStore, resetMockStore } from '@/lib/api/mock/store'
import type { PlanCompanionSummary } from '@/types/plan'

/**
 * 반려견 삭제 × 일정 동행 (#1042) — 목이 plan-service 계약을 흉내 내는가.
 *
 * 근거: `PlanCompanionWebController` · `PlanQueryProcessor.getCompanionSummary` ·
 * `PlanPetDetachProcessor`(R1~R3) · auth `PetCommandProcessor.delete` 소스 실측
 * (origin/develop, 2026-09-29).
 *
 * 시드(데모 회원): 몽실이(…001, 대표) · 초코(…002).
 *  - 일정 …001 DRAFT     [몽실이, 초코]
 *  - 일정 …002 CONFIRMED [초코]
 *  - 일정 …003 COMPLETED [몽실이]
 *  - 일정 …004 CONFIRMED [몽실이]
 */

const DEMO_TOKEN = 'mock-access-900000000000000001'
const MONGSIL = '123456789012000001'
const CHOCO = '123456789012000002'
const OTHERS_PET = '123456789012000099'

function call(path: string, method: string, token: string | null = DEMO_TOKEN) {
  return resolveMock(path, method, '', null, token)
}

function summaryOf(petId: string): PlanCompanionSummary {
  return call(`/plans/companions/${petId}`, 'GET')?.payload.dataBody as PlanCompanionSummary
}

function planPets(planId: string): { petId: string; petIds: string[] } {
  const plan = mockStore().plans.find((candidate) => candidate.planId === planId)
  return { petId: plan?.petId ?? '', petIds: plan?.petIds ?? [] }
}

describe('동행 일정 집계 mock — GET /plans/companions/{petId}', () => {
  beforeEach(resetMockStore)

  it('미완료 · 그중 혼자 · 완료를 센다', () => {
    expect(summaryOf(MONGSIL)).toEqual({
      petId: MONGSIL,
      editablePlanCount: 2,
      soleCompanionPlanCount: 1,
      completedPlanCount: 1,
    })
    expect(summaryOf(CHOCO)).toEqual({
      petId: CHOCO,
      editablePlanCount: 2,
      soleCompanionPlanCount: 1,
      completedPlanCount: 0,
    })
  })

  it('남의 반려견 · 없는 반려견도 404 가 아니라 0 / 0 / 0 이다', () => {
    const others = call(`/plans/companions/${OTHERS_PET}`, 'GET')
    expect(others?.status).toBe(200)
    expect(others?.payload.dataBody).toEqual({
      petId: OTHERS_PET,
      editablePlanCount: 0,
      soleCompanionPlanCount: 0,
      completedPlanCount: 0,
    })
    expect(call('/plans/companions/123456789012009999', 'GET')?.status).toBe(200)
  })

  it('숫자가 아닌 petId 는 400 이다 — @PathVariable long 바인딩', () => {
    const result = call('/plans/companions/abc', 'GET')
    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_124')
  })

  it('토큰이 없으면 401 이다', () => {
    expect(call(`/plans/companions/${MONGSIL}`, 'GET', null)?.status).toBe(401)
  })

  it('일정 상세 경로로 새지 않는다 — 세그먼트가 둘이다', () => {
    expect(call(`/plans/companions/${MONGSIL}`, 'GET')?.payload.dataHeader.resultCode).not.toBe(
      'PLAN_001',
    )
  })
})

describe('반려견 삭제 mock — 일정 동행 정리 (R1~R3)', () => {
  beforeEach(resetMockStore)

  it('다견 미완료 일정에서 그 아이를 떼고 대표를 남은 첫 아이로 올린다 (R2)', () => {
    call(`/members/me/pets/${MONGSIL}`, 'DELETE')

    expect(planPets('223456789012000001')).toEqual({ petId: CHOCO, petIds: [CHOCO] })
  })

  it('그 아이만 동행하던 미완료 일정은 지운 id 를 자리 표시자로 남긴다 (R3)', () => {
    call(`/members/me/pets/${MONGSIL}`, 'DELETE')

    expect(planPets('223456789012000004')).toEqual({ petId: MONGSIL, petIds: [MONGSIL] })
  })

  it('완료 일정은 손대지 않는다 (R1)', () => {
    call(`/members/me/pets/${MONGSIL}`, 'DELETE')

    expect(planPets('223456789012000003')).toEqual({ petId: MONGSIL, petIds: [MONGSIL] })
  })

  it('지운 뒤의 집계는 떼어진 일정을 세지 않는다 — 자리 표시자 일정만 남는다', () => {
    call(`/members/me/pets/${CHOCO}`, 'DELETE')

    expect(summaryOf(CHOCO)).toEqual({
      petId: CHOCO,
      editablePlanCount: 1,
      soleCompanionPlanCount: 1,
      completedPlanCount: 0,
    })
  })

  it('대표견을 지우면 남은 아이 중 먼저 등록한 아이가 대표가 된다', () => {
    call(`/members/me/pets/${MONGSIL}`, 'DELETE')

    const choco = mockStore().pets.find((pet) => pet.petId === CHOCO)
    expect(choco?.representative).toBe(true)
  })

  it('대표가 아닌 아이를 지우면 대표는 그대로다', () => {
    call(`/members/me/pets/${CHOCO}`, 'DELETE')

    const mongsil = mockStore().pets.find((pet) => pet.petId === MONGSIL)
    expect(mongsil?.representative).toBe(true)
  })
})
