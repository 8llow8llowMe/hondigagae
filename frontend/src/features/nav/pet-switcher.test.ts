import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PetSwitcher } from '@/features/nav/pet-switcher'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

function pet(petId: string, name: string): Pet {
  return {
    petId,
    name,
    breed: '말티즈',
    birthYm: '2022-04',
    age: 4,
    sizeType: { code: 'SMALL', name: '소형견' },
    weightKg: null,
    profileImageUrl: null,
    representative: false,
    heatSensitive: true,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: { code: 'MEDIUM', name: '보통' },
    walkPreferred: true,
    sociality: { code: 'HIGH', name: '높음' },
  }
}

function render(pets: Pet[], totalCount = pets.length) {
  return renderToStaticMarkup(createElement(PetSwitcher, { pets, totalCount }))
}

describe('PetSwitcher — 반려견 있음 (명세 D7 #3)', () => {
  it('첫 반려견 이름을 트리거에 보여준다', () => {
    const markup = render([pet('1', '몽실이'), pet('2', '초코')])

    expect(markup).toContain('몽실이')
  })

  it('트리거에 aria-expanded 가 있다 (D6)', () => {
    expect(render([pet('1', '몽실이')])).toContain('aria-expanded="false"')
  })

  it('닫힌 상태에서는 드롭다운을 렌더하지 않는다', () => {
    expect(render([pet('1', '몽실이'), pet('2', '초코')])).not.toContain('role="menu"')
  })
})

describe('PetSwitcher — 반려견 0마리 (명세 D7 #4)', () => {
  it('스위처 대신 "반려견 등록" 을 보여준다 — 빈 드롭다운을 두지 않는다', () => {
    const markup = render([])

    expect(markup).toContain(messages.home.registerPet)
    expect(markup).toContain('href="/pets/new"')
    expect(markup).not.toContain('aria-expanded')
  })
})

describe('PetSwitcher — 긴 이름 (명세 D7 #6)', () => {
  it('20자 이름에도 truncate 로 헤더를 밀지 않는다', () => {
    const longName = '가'.repeat(20)
    const markup = render([pet('1', longName)])

    expect(markup).toContain('truncate')
    expect(markup).toContain('max-w-40')
    expect(markup).toContain(longName)
  })
})
