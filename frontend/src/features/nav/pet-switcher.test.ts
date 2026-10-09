import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

/** 트리거 여는 태그 — 클래스 단언을 이 안으로 좁힌다 (마크업 전체 단언은 거짓 초록이 되기 쉽다) */
function triggerTag(markup: string): string {
  return /<button[^>]*aria-haspopup="menu"[^>]*>/.exec(markup)?.[0] ?? ''
}

/** 태그를 걷고 공백을 하나로 — 보조기기가 읽는 이름과 같은 글자 */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('PetSwitcher — 접근 이름 (장소-반려견칩 D6, #1301)', () => {
  it('헤더 트리거의 이름이 `반려견 바꾸기, 지금 몽실이` 다', () => {
    const markup = render([pet('1', '몽실이'), pet('2', '초코')])

    expect(textOf(markup)).toBe(`${messages.pet.switcherNamePrefix} 몽실이`)
  })

  it('앞말은 sr-only 스팬 안이다 — 헤더 픽셀이 바뀌지 않는다', () => {
    const markup = render([pet('1', '몽실이')])

    expect(markup).toContain(`<span class="sr-only">${messages.pet.switcherNamePrefix} </span>`)
  })

  it('aria-label 로 보이는 이름을 덮지 않는다', () => {
    expect(triggerTag(render([pet('1', '몽실이')]))).not.toContain('aria-label')
  })
})

function renderChip(pets: Pet[], totalCount = pets.length): string {
  return renderToStaticMarkup(createElement(PetSwitcher, { pets, totalCount, variant: 'chip' }))
}

describe('PetSwitcher variant="chip" — 지도 필터 줄 칩 (#1301 D7-4)', () => {
  it('트리거는 메뉴를 여는 꺼진 칩이다 — Chip md 44 · rounded-md · 켠 색 없음', () => {
    const tag = triggerTag(renderChip([pet('1', '몽실이'), pet('2', '초코')]))

    expect(tag).toContain('aria-haspopup="menu"')
    expect(tag).toContain('aria-expanded="false"')
    expect(tag).toContain('aria-controls=')
    expect(tag).toContain('h-11')
    expect(tag).toContain('rounded-md')
    expect(tag).not.toMatch(/(^|\s|")bg-band(\s|")/)
    expect(tag).not.toContain('aria-pressed')
  })

  it('아바타 하나 · 이름은 max-w-20 truncate · 접근 이름은 헤더와 같다', () => {
    const markup = renderChip([pet('1', '몽실이'), pet('2', '초코')])

    expect(markup.match(/<img[^>]*>/g)).toHaveLength(1)
    expect(markup).toMatch(/<span class="max-w-20 truncate">몽실이<\/span>/)
    expect(textOf(markup)).toBe(`${messages.pet.switcherNamePrefix} 몽실이`)
  })

  it('1마리도 메뉴를 여는 트리거다 — ▾ 와 함께 선다', () => {
    const markup = renderChip([pet('1', '몽실이')])

    expect(triggerTag(markup)).not.toBe('')
    expect(markup).toContain('<svg')
  })

  it('0마리면 아무것도 그리지 않는다 — 등록 유도 링크도 없다', () => {
    expect(renderChip([])).toBe('')
  })

  it('헤더 갈래(기본)는 칩 모양이 아니다 — 기존 트리거 그대로', () => {
    const tag = triggerTag(render([pet('1', '몽실이')]))

    expect(tag).toContain('max-w-40')
    expect(tag).not.toContain('border')
  })
})

/**
 * 열린 메뉴는 정적 렌더로 볼 수 없다 — 갈래별로 메뉴에 무엇을 넘기는지를 소스로 잠근다. 넘겨받은 값을 메뉴가
 * 어떻게 그리는지는 `pet-switcher-menu.test.ts` 가 잰다.
 */
describe('PetSwitcher — 갈래별 메뉴 자리 (#1301)', () => {
  const source = readFileSync(fileURLToPath(new URL('./pet-switcher.tsx', import.meta.url)), 'utf8')

  it('칩은 왼쪽 끝 · 잰 방향 · 시트 손잡이 제외, 헤더는 오른쪽 끝 · 아래', () => {
    expect(source).toContain("align={isChip ? 'start' : 'end'}")
    expect(source).toContain("placement={isChip ? placement : 'below'}")
    expect(source).toContain('noSheetDrag={isChip}')
  })
})
