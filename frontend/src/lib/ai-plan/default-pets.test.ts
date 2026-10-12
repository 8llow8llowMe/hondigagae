import { describe, expect, it } from 'vitest'

import { defaultAiPlanPetIds } from '@/lib/ai-plan/default-pets'
import { pet, secondPet } from '@/test/fixtures/plan'
import type { Pet } from '@/types/pet'

/** AI 조건 폼의 반려견 미리 선택 — 이슈 #1381 */
const third: Pet = { ...secondPet, petId: '9003', name: '콩' }

describe('defaultAiPlanPetIds', () => {
  it('한 마리뿐이면 그 아이다', () => {
    expect(defaultAiPlanPetIds([pet], null)).toEqual([pet.petId])
  })

  it('여러 마리면 헤더에서 고른 아이다', () => {
    expect(defaultAiPlanPetIds([pet, secondPet, third], third.petId)).toEqual([third.petId])
  })

  it('고른 아이가 없으면 대표견이다', () => {
    const representative = { ...secondPet, representative: true }
    expect(defaultAiPlanPetIds([pet, representative, third], null)).toEqual([representative.petId])
  })

  it('고른 아이가 목록에 없으면(지운 아이) 대표견으로 떨어진다', () => {
    const representative = { ...third, representative: true }
    expect(defaultAiPlanPetIds([pet, secondPet, representative], 'gone')).toEqual([
      representative.petId,
    ])
  })

  it('고른 아이도 대표견도 없으면 헤더가 보여 주는 첫 아이다', () => {
    expect(defaultAiPlanPetIds([pet, secondPet], null)).toEqual([pet.petId])
  })

  it('반려견이 없으면 비운다', () => {
    expect(defaultAiPlanPetIds([], 'x')).toEqual([])
  })
})
