import { describe, expect, it } from 'vitest'

import { describePet, petAgeText } from '@/lib/pet/describe'
import type { Pet } from '@/types/pet'

const pet: Pet = {
  petId: '123456789012000001',
  name: '몽실이',
  breed: '말티즈',
  birthYm: '2017-05',
  age: 9,
  sizeType: { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
  weightKg: null,
  profileImageUrl: null,
  representative: false,
  heatSensitive: false,
  coldSensitive: false,
  noiseSensitive: false,
  activityLevel: {
    code: 'MEDIUM',
    name: '보통',
    description: '일반적인 산책과 관광 일정을 소화합니다.',
  },
  walkPreferred: false,
  sociality: { code: 'HIGH', name: '높음', description: '다른 개나 사람과 잘 어울립니다.' },
}

describe('petAgeText — 나이 단위는 한 곳에서만 정한다', () => {
  /*
    **두 화면이 다른 낱말을 썼다.** 반려견 목록 행은 `6세`, 일정 만들기 폼은 `6살` 로
    같은 값을 다르게 불렀다 (dev 실데이터로 확인). 서버는 숫자(`age`)만 주므로 단위는
    전부 FE 문구다 — 그래서 조립 지점을 하나로 모은다.

    **`살` 로 통일한다.** 이 서비스의 어미는 해요체이고(`DESIGN.md` §1) `describePet` 의
    주석이 세 자리에서 `4살` 을 정본 예시로 들고 있다. `세` 는 이 톤에서 혼자 격식체다.
  */
  it('나이를 살 단위로 쓴다', () => {
    expect(petAgeText(6)).toBe('6살')
    expect(petAgeText(0)).toBe('0살')
  })

  it('나이를 모르면 null 이다 — 호출부가 그 줄을 빼도록', () => {
    expect(petAgeText(null)).toBe(null)
  })
})

describe('describePet — 조각이 없으면 null 이다', () => {
  it('크기를 넣으면 세 조각이다', () => {
    expect(describePet(pet, { size: true })).toContain(pet.sizeType.name)
  })

  it('나이 조각은 petAgeText 와 같은 낱말을 쓴다', () => {
    const line = describePet(pet)

    expect(line).toContain(petAgeText(pet.age) as string)
  })

  it('조각이 하나도 없으면 빈 문자열이 아니라 null 이다', () => {
    expect(describePet({ ...pet, breed: null, age: null })).toBe(null)
  })
})
