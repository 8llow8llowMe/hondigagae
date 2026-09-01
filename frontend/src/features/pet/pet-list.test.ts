import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PetListSection, type PetListSectionProps } from '@/features/pet/pet-list-section'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

function pet(overrides: Partial<Pet> = {}): Pet {
  return {
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
    ...overrides,
  }
}

function render(overrides: Partial<PetListSectionProps> = {}) {
  return renderToStaticMarkup(
    createElement(PetListSection, {
      pets: [pet()],
      totalCount: 1,
      loading: false,
      errorStatus: null,
      onRetry: () => undefined,
      ...overrides,
    }),
  )
}

describe('PetListSection', () => {
  it('반려견 2마리를 렌더한다', () => {
    const markup = render({
      pets: [pet(), pet({ petId: '123456789012000002', name: '초코' })],
      totalCount: 2,
    })

    expect(markup).toContain('몽실이')
    expect(markup).toContain('초코')
  })

  it('빈 목록은 EmptyState 이고 재시도 버튼이 없다', () => {
    const markup = render({ pets: [], totalCount: 0 })

    expect(markup).toContain(messages.pet.emptyTitle)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('5xx 는 ErrorState 이고 재시도 버튼이 있다', () => {
    const markup = render({ errorStatus: 500 })

    expect(markup).toContain(messages.pet.loadFailedTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('loading 이면 스켈레톤만 렌더한다', () => {
    const markup = render({ loading: true })

    expect(markup).not.toContain('몽실이')
    expect(markup).not.toContain(messages.pet.register)
  })

  it('breed 가 null 이면 품종을 렌더하지 않는다 — "정보 없음" 을 그리지 않는다', () => {
    const markup = render({ pets: [pet({ breed: null })] })

    expect(markup).not.toContain('말티즈')
    expect(markup).toContain('몽실이')
  })

  it('breed 가 빈 문자열이어도 렌더하지 않는다 — 서버가 "" 를 저장할 수 있다', () => {
    const markup = render({ pets: [pet({ breed: '' })] })

    expect(markup).toContain('몽실이')
  })

  it('birthYm / age 가 null 이면 생년월·나이를 렌더하지 않는다', () => {
    const markup = render({ pets: [pet({ birthYm: null, age: null })] })

    expect(markup).not.toContain('2017-05')
    expect(markup).not.toContain('9세')
  })

  it('boolean 4개가 전부 false 면 성향 배지가 없다', () => {
    const markup = render()

    expect(markup).not.toContain(messages.pet.labels.heatSensitive)
    expect(markup).not.toContain(messages.pet.labels.walkPreferred)
  })

  it('true 인 성향만 배지로 렌더한다', () => {
    const markup = render({
      pets: [pet({ heatSensitive: true, noiseSensitive: true })],
    })

    expect(markup).toContain(messages.pet.labels.heatSensitive)
    expect(markup).toContain(messages.pet.labels.noiseSensitive)
    expect(markup).not.toContain(messages.pet.labels.coldSensitive)
    expect(markup).not.toContain(messages.pet.labels.walkPreferred)
  })

  it('enum metadata 의 name 을 그대로 렌더한다 — FE 매핑 테이블이 없다', () => {
    const markup = render()

    expect(markup).toContain('소형견')
    expect(markup).toContain('보통')
    expect(markup).toContain('높음')
  })

  it('상한(5마리)이면 등록 버튼이 disabled 이고 이유가 함께 있다', () => {
    const markup = render({ totalCount: 5 })

    expect(markup).toContain('disabled=""')
    expect(markup).toContain(messages.pet.limitReached)
  })

  it('4마리면 등록 버튼이 활성이고 상한 문구가 없다', () => {
    const markup = render({ totalCount: 4 })

    expect(markup).not.toContain('disabled=""')
    expect(markup).not.toContain(messages.pet.limitReached)
  })

  it('카드가 Link 로 감싸여 수정 화면을 가리킨다 — div + onClick 이 아니다', () => {
    const markup = render()

    expect(markup).toContain('href="/pets/123456789012000001"')
  })

  it('카드 제목이 heading 이다', () => {
    const markup = render()

    expect(markup).toMatch(/<h2[^>]*>몽실이<\/h2>/)
  })

  it('건수를 상한과 함께 표시한다', () => {
    const markup = render({ totalCount: 2, pets: [pet()] })

    expect(markup).toContain('2 / 5')
  })
})
