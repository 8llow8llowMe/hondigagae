import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { PetSwitcherMenu } from '@/features/nav/pet-switcher-menu'
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

const TWO = [pet('1', '몽실이'), pet('2', '초코')]

function render(
  overrides: Partial<{
    pets: Pet[]
    selectedPetId: string
    totalCount: number
    align: 'start' | 'end'
    placement: 'below' | 'above'
    noSheetDrag: boolean
  }> = {},
): string {
  const pets = overrides.pets ?? TWO
  return renderToStaticMarkup(
    createElement(PetSwitcherMenu, {
      id: 'menu',
      pets,
      selectedPetId: overrides.selectedPetId ?? pets[0]?.petId ?? '',
      totalCount: overrides.totalCount ?? pets.length,
      onSelect: vi.fn(),
      onClose: vi.fn(),
      align: overrides.align ?? 'end',
      placement: overrides.placement ?? 'below',
      ...(overrides.noSheetDrag === undefined ? {} : { noSheetDrag: overrides.noSheetDrag }),
    }),
  )
}

/** 패널 여는 태그 — 자리 클래스 단언을 이 안으로 좁힌다 */
function panelTag(markup: string): string {
  return /<div[^>]*role="menu"[^>]*>/.exec(markup)?.[0] ?? ''
}

function classesOf(tag: string): string[] {
  return /class="([^"]*)"/.exec(tag)?.[1]?.split(/\s+/) ?? []
}

/**
 * 반려견 스위처 메뉴 — 헤더 · 지도 필터 줄 칩 공용 (장소-반려견칩-세부명세 D7-4, #1301).
 */
describe('PetSwitcherMenu — 항목', () => {
  it('항목 순서는 목록 순서다', () => {
    const markup = render()

    expect(markup.indexOf('몽실이')).toBeLessThan(markup.indexOf('초코'))
  })

  it('고른 반려견 하나만 aria-checked="true" 이고 체크 아이콘도 하나다', () => {
    const markup = render({ selectedPetId: '2' })
    const items = markup.match(/<button[^>]*role="menuitemradio"[^>]*>/g) ?? []

    expect(items).toHaveLength(2)
    expect(items.filter((tag) => tag.includes('aria-checked="true"'))).toHaveLength(1)
    expect(items[1]).toContain('aria-checked="true"')
    expect(markup.match(/<svg/g)).toHaveLength(1)
  })

  it('값을 고르는 라디오다 — aria-current 를 쓰지 않는다', () => {
    expect(render()).not.toContain('aria-current')
  })

  it('1마리도 등록 항목이 있다 — /pets/new 로 가는 menuitem', () => {
    const markup = render({ pets: [pet('1', '몽실이')] })

    const link = /<a[^>]*href="\/pets\/new"[^>]*>/.exec(markup)?.[0] ?? ''

    expect(link).toContain('role="menuitem"')
    expect(markup).toContain(messages.home.registerPet)
  })

  it('5마리면 등록 링크 대신 비활성 + 상한 안내다', () => {
    const five = ['1', '2', '3', '4', '5'].map((id) => pet(id, `반려견${id}`))
    const markup = render({ pets: five })

    expect(markup).not.toContain('href="/pets/new"')
    expect(markup).toContain(messages.pet.limitReached)
  })

  it('메뉴 이름은 `반려견 전환` 이다', () => {
    expect(panelTag(render())).toContain(`aria-label="${messages.pet.switcherMenuLabel}"`)
    expect(messages.pet.switcherMenuLabel).toBe('반려견 전환')
  })
})

describe('PetSwitcherMenu — 자리', () => {
  it('align="end"(헤더)는 오른쪽 끝 · 아래다', () => {
    const classes = classesOf(panelTag(render({ align: 'end' })))

    expect(classes).toContain('end-0')
    expect(classes).not.toContain('start-0')
    expect(classes).toContain('top-full')
    expect(classes).toContain('mt-1')
  })

  it('align="start"(칩)는 왼쪽 끝이다 — end-0 이면 화면 왼쪽 밖으로 나간다', () => {
    const classes = classesOf(panelTag(render({ align: 'start' })))

    expect(classes).toContain('start-0')
    expect(classes).not.toContain('end-0')
  })

  it('placement="above" 면 위로 연다', () => {
    const classes = classesOf(panelTag(render({ placement: 'above' })))

    expect(classes).toContain('bottom-full')
    expect(classes).toContain('mb-1')
    expect(classes).not.toContain('top-full')
  })

  it('noSheetDrag 면 시트 손잡이에서 빠진다', () => {
    expect(panelTag(render({ noSheetDrag: true }))).toContain('data-sheet-no-drag=""')
    expect(panelTag(render())).not.toContain('data-sheet-no-drag')
  })
})
