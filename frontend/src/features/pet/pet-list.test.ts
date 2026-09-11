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

  it('행 제목은 h3 다 — 카드 제목(h2) 아래 한 단이다', () => {
    /*
      3a 에서 목록이 카드 안으로 들어오며 카드가 `h2`(`내 반려견`)를 갖는다. 행이 같은
      레벨에 남으면 문서 구조가 평평해진다 (#464).
    */
    const markup = render()

    expect(markup).toMatch(/<h3[^>]*>몽실이<\/h3>/)
    expect(markup).toMatch(/<h2[^>]*>내 반려견<\/h2>/)
  })

  it('건수를 상한과 함께 표시한다', () => {
    const markup = render({ totalCount: 2, pets: [pet()] })

    expect(markup).toContain('2/5마리')
  })
})

describe('PetListSection — 3층 표면 (DESIGN.md §0, #464)', () => {
  it('카드 하나로 그린다 — Surface 를 쓰고 카드가 하나다', () => {
    /*
      L1 의 외형(radius·테두리)은 `surface.test.ts` 가 소유한다 — 여기서 다시 단언하면
      프리미티브의 클래스 순서만 바뀌어도 이 화면 테스트가 깨진다.
    */
    const markup = render()

    expect(markup).toMatch(/^<section [^>]*aria-labelledby="pet-list-heading"/)
    expect(markup.match(/<section/g)).toHaveLength(1)
  })

  it('제목은 카드 안 h2 다 — h1 은 페이지가 sr-only 로 갖는다', () => {
    const markup = render()

    expect(markup).toContain('<h2 id="pet-list-heading"')
    expect(markup).not.toContain('<h1')
  })

  it('행은 인셋만 갖는다 — 2a 의 last prop 이 마크업에서 사라졌다', () => {
    /*
      `not.toContain('border-b')` 로는 못 잡는다 — `border-border` 안에 그 문자열이 있다.
      행의 class 만 뽑아 **인셋 말고는 아무것도 없다**를 단언한다.
    */
    const markup = render({ pets: [pet(), pet({ petId: '123456789012000002', name: '초코' })] })
    const rowClasses = [...markup.matchAll(/<li class="([^"]*)"/g)].map(([, value]) => value)

    expect(rowClasses).toEqual(['px-4 md:px-5', 'px-4 md:px-5'])
  })

  it('네 상태가 모두 카드 인셋(16/20)에 선다', () => {
    // 축이 갈리면 목록이 바뀌는 순간 왼쪽 선이 뛴다 (#451)
    const CARD_INSET = 'px-4 md:px-5'

    expect(render({ loading: true })).toContain(CARD_INSET)
    expect(render({ errorStatus: 500 })).toContain(CARD_INSET)
    expect(render({ pets: [], totalCount: 0 })).toContain(CARD_INSET)
    expect(render()).toContain(CARD_INSET)

    // 페이지 인셋(40)이 카드 안에 남아 있지 않다
    expect(render()).not.toContain('md:px-10')
  })

  it('스켈레톤도 같은 목록 규약을 쓴다 — 로딩이 끝날 때 선이 새로 생기지 않는다', () => {
    const markup = render({ loading: true })

    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
    expect(markup).toContain('aria-busy="true"')
  })
})

describe('PetListSection — 등록 버튼은 셀 수 있을 때만 머리에 (#464)', () => {
  /*
    로딩 중에는 `totalCount` 가 0 이라 상한에 닿은 사람에게도 눌리는 버튼이 서고,
    눌러 들어가면 필드 10개를 채운 뒤 `PET_002` 를 받는다 — 이 화면이 막으려던 낭비다.
  */
  it('로딩 중에는 머리에 등록 버튼을 두지 않는다', () => {
    expect(render({ loading: true })).not.toContain(messages.pet.register)
  })

  it('오류에도 두지 않는다', () => {
    expect(render({ errorStatus: 500 })).not.toContain(messages.pet.register)
  })

  it('0건에는 EmptyState 의 등록 버튼 하나만 남는다', () => {
    const markup = render({ pets: [], totalCount: 0 })
    const buttons = markup.match(new RegExp(messages.pet.register, 'g'))

    expect(buttons).toHaveLength(1)
    expect(markup).toContain(messages.pet.emptyTitle)
  })

  it('상한에 닿으면 머리 버튼이 disabled 이고 이유를 글자로 함께 낸다', () => {
    const markup = render({ totalCount: 5, pets: [pet()] })

    expect(markup).toContain('disabled')
    expect(markup).toContain(messages.pet.limitReached)
    // 상한이라고 목록을 숨기지 않는다 — 여기서 지워야 새로 등록할 수 있다
    expect(markup).toContain('몽실이')
  })
})
