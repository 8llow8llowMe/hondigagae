import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import {
  aiPlanForPetHref,
  petListDescription,
  REGISTERED_PET_PARAM,
  registeredPet,
  registeredPetListHref,
} from '@/lib/pet/next-step'

const pets = [
  { petId: '123456789012000001', name: '몽실이' },
  { petId: '123456789012000002', name: '곰' },
]

describe('aiPlanForPetHref — 등록 뒤 다음 행동 (#1430)', () => {
  it('AI 일정 만들기로 반려견 id 를 pet 쿼리에 실어 보낸다', () => {
    expect(aiPlanForPetHref('123456789012000001')).toBe('/ai-plans/new?pet=123456789012000001')
  })

  it('id 를 인코딩한다 — 문자열 id 를 그대로 붙이지 않는다', () => {
    expect(aiPlanForPetHref('a b&c')).toBe('/ai-plans/new?pet=a%20b%26c')
  })
})

describe('registeredPetListHref / registeredPet — 목록이 방금 등록한 아이를 안다', () => {
  it('목록 주소에 등록한 id 를 싣는다', () => {
    expect(registeredPetListHref('123456789012000002')).toBe(
      `/pets?${REGISTERED_PET_PARAM}=123456789012000002`,
    )
  })

  it('목록에 있는 id 면 그 반려견을 돌려준다', () => {
    expect(registeredPet(pets, '123456789012000002')?.name).toBe('곰')
  })

  it.each([[undefined], [''], ['999'], [['123456789012000001', 'x']]])(
    '없거나 목록에 없는 값(%s)이면 null 이다 — 지어내지 않는다',
    (raw) => {
      expect(registeredPet(pets, raw)).toBeNull()
    },
  )
})

describe('petListDescription — 반려견 수에 따라 안내가 다르다', () => {
  it('0마리면 등록을 권한다', () => {
    expect(petListDescription(0)).toBe(messages.pet.listDescription)
  })

  it('셀 수 없으면(로딩·오류) 기본 문구다', () => {
    expect(petListDescription(null)).toBe(messages.pet.listDescription)
  })

  it('1~4마리면 등록을 처음부터 권하지 않는다', () => {
    expect(petListDescription(1)).toBe(messages.pet.listDescriptionSome)
    expect(petListDescription(4)).toBe(messages.pet.listDescriptionSome)
    expect(petListDescription(3)).not.toBe(messages.pet.listDescription)
  })

  it('상한(5마리)이면 더 등록하라고 말하지 않는다', () => {
    expect(petListDescription(5)).toBe(messages.pet.listDescriptionFull)
  })
})
