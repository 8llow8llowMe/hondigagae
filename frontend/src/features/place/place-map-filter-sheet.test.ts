import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceMapFilterButton,
  PlaceMapFilterSheetFields,
} from '@/features/place/place-map-filter-sheet'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { Pet } from '@/types/pet'

const noop = () => undefined

const pet: Pet = {
  petId: '1',
  name: '몽실이',
  breed: '말티즈',
  birthYm: '2022-03',
  age: 4,
  sizeType: { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
  weightKg: null,
  profileImageUrl: null,
  representative: false,
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: true,
  activityLevel: { code: 'MEDIUM', name: '보통', description: null },
  walkPreferred: true,
  sociality: { code: 'MEDIUM', name: '보통', description: null },
}

function renderButton(count: number, expanded = false): string {
  return renderToStaticMarkup(
    createElement(PlaceMapFilterButton, { count, expanded, onSelect: noop }),
  )
}

/** 버튼 여는 태그 — 클래스 단언을 이 안으로 좁힌다 (마크업 전체 단언은 거짓 초록이 되기 쉽다) */
function buttonTag(markup: string): string {
  return /<button[^>]*>/.exec(markup)?.[0] ?? ''
}

/** 태그를 걷고 공백을 하나로 — 보조기기가 읽는 이름과 같은 글자 */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('PlaceMapFilterButton — 걸린 조건 없음 (#1314 D6)', () => {
  const markup = renderButton(0)
  const tag = buttonTag(markup)

  it('이름은 `필터` 하나다', () => {
    expect(textOf(markup)).toBe(messages.place.filterTitle)
  })

  it('시트를 여는 버튼이다 — aria-expanded · aria-haspopup="dialog", aria-pressed 없음', () => {
    expect(tag).toContain('aria-expanded="false"')
    expect(tag).toContain('aria-haspopup="dialog"')
    expect(tag).not.toContain('aria-pressed')
  })

  it('aria-label 로 보이는 글자를 덮지 않는다', () => {
    expect(tag).not.toContain('aria-label')
  })

  it('Chip sm(모바일 36 · ≥768 44)이고 끈 색이다', () => {
    expect(tag).toMatch(/(\s|")h-9(\s|")/)
    expect(tag).toContain('md:h-11')
    expect(tag).not.toMatch(/(\s|")bg-band(\s|")/)
    expect(tag).toContain('font-medium')
  })
})

describe('PlaceMapFilterButton — 시트 축 2개 걸림', () => {
  const markup = renderButton(2, true)
  const tag = buttonTag(markup)

  it('이름은 `필터, 2개 적용됨` — 숫자만 보이고 앞뒤는 sr-only', () => {
    expect(textOf(markup)).toBe(
      `${messages.place.filterTitle}, 2${messages.place.filterAppliedCountSuffix}`,
    )
    expect(markup).toContain('<span class="sr-only">, </span>')
    expect(markup).toContain(
      `<span class="sr-only">${messages.place.filterAppliedCountSuffix}</span>`,
    )
    expect(markup).toContain('<span class="tabular-nums">2</span>')
  })

  it('켠 색이고 열림을 말한다', () => {
    expect(tag).toMatch(/(\s|")bg-band(\s|")/)
    expect(tag).toContain('font-semibold')
    expect(tag).toContain('aria-expanded="true"')
  })
})

describe('PlaceMapFilterSheetFields — 절 순서 (#1314 D2-5)', () => {
  function renderFields(withPet: boolean): string {
    return renderToStaticMarkup(
      createElement(PlaceMapFilterSheetFields, {
        filters: DEFAULT_PLACE_FILTERS,
        onChange: noop,
        pet: withPet ? pet : null,
      }),
    )
  }

  function headings(markup: string): string[] {
    return [...markup.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1] ?? '')
  }

  it('지역 → 실내 / 야외 → 견종 크기 제한', () => {
    expect(headings(renderFields(true))).toEqual([
      messages.place.filterRegionLabel,
      messages.place.filterIndoorLabel,
      messages.place.filterPetSizeLabel,
    ])
  })

  it('반려견이 없으면 체구 절이 제목째 없다', () => {
    const markup = renderFields(false)

    expect(headings(markup)).toEqual([
      messages.place.filterRegionLabel,
      messages.place.filterIndoorLabel,
    ])
    expect(markup).not.toContain('role="checkbox"')
  })

  it('각 절 제목 밑에 그 절의 컨트롤이 선다 — 제목만 남은 빈 절이 아니다', () => {
    const markup = renderFields(true)
    const order = [
      `>${messages.place.filterRegionLabel}</h3>`,
      '서귀포시',
      `>${messages.place.filterIndoorLabel}</h3>`,
      '실내만',
      '야외만',
      messages.place.filterIndoorUnknownNote,
      `>${messages.place.filterPetSizeLabel}</h3>`,
      'role="checkbox"',
    ].map((needle) => markup.indexOf(needle))

    expect(order.every((index) => index > -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('지역 선택지가 다 선다 — 기본은 `제주 전체`', () => {
    const markup = renderFields(false)

    expect(markup).toContain(messages.place.filterRegionAll)
    expect(markup).toContain('제주시')
    expect(markup).toContain('서귀포시')
  })
})
