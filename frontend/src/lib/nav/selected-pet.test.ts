import { describe, expect, it } from 'vitest'

import { resolveSelectedPet } from '@/lib/nav/selected-pet'
import type { Pet } from '@/types/pet'

function pet(petId: string, name: string): Pet {
  return {
    petId,
    name,
    breed: '말티즈',
    birthYm: '2022-04',
    age: 4,
    sizeType: { code: 'SMALL', name: '소형견' },
    heatSensitive: true,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: { code: 'MEDIUM', name: '보통' },
    walkPreferred: true,
    sociality: { code: 'HIGH', name: '높음' },
  }
}

const pets = [pet('1', '몽실이'), pet('2', '초코')]

describe('resolveSelectedPet', () => {
  it('저장된 petId 를 목록에서 찾아 돌려준다', () => {
    expect(resolveSelectedPet(pets, '2')?.name).toBe('초코')
  })

  it('저장된 petId 가 목록에 없으면 첫 번째로 떨어진다', () => {
    // 반려견을 삭제했거나 다른 계정으로 로그인하면 실제로 이 상황이 된다
    expect(resolveSelectedPet(pets, '999')?.name).toBe('몽실이')
  })

  it('저장값이 없으면 첫 번째다', () => {
    expect(resolveSelectedPet(pets, null)?.name).toBe('몽실이')
  })

  it('목록이 비면 null 이다 — 호출부가 "반려견 등록" 버튼을 그린다', () => {
    expect(resolveSelectedPet([], '1')).toBeNull()
    expect(resolveSelectedPet([], null)).toBeNull()
  })
})
