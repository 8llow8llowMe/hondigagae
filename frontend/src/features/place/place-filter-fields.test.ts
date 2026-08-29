import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  ContentTypeField,
  IndoorField,
  PetAllowanceField,
  PetSizeField,
} from '@/features/place/place-filter-fields'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { Pet } from '@/types/pet'
import type { PlaceFilters } from '@/types/place'

const noop = () => undefined

const pet: Pet = {
  petId: '1',
  name: '몽실이',
  breed: '말티즈',
  birthYm: '2022-03',
  age: 4,
  sizeType: { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: true,
  activityLevel: { code: 'MEDIUM', name: '보통', description: null },
  walkPreferred: true,
  sociality: { code: 'MEDIUM', name: '보통', description: null },
}

function render(element: React.ReactElement) {
  return renderToStaticMarkup(element)
}

/**
 * 켜져 있는 옵션의 라벨.
 *
 * 마크업을 글자 수로 잘라 보면 클래스 문자열이 길어질 때마다 테스트가 깨진다.
 * `aria-checked="true"` 뒤에 처음 오는 라벨 span 의 텍스트만 뽑는다.
 */
function checkedLabel(markup: string): string | null {
  const matched = /aria-checked="true"[\s\S]*?block[^"]*">([^<]+)</.exec(markup)
  return matched?.[1] ?? null
}

describe('PetAllowanceField — 동반 축은 "가능만" 한 갈래다', () => {
  it('다중 축이므로 checkbox 로 나간다 (배타 축을 aria-pressed 로 두지 않는 것과 짝이다)', () => {
    const markup = render(
      createElement(PetAllowanceField, { filters: DEFAULT_PLACE_FILTERS, onChange: noop }),
    )

    expect(markup).toContain('role="checkbox"')
    expect(markup).toContain('aria-checked="false"')
    expect(markup).toContain(messages.place.filterAllowedOnly)
  })

  it('ALLOWED 일 때만 체크된다', () => {
    const on: PlaceFilters = { ...DEFAULT_PLACE_FILTERS, petAllowanceType: 'ALLOWED' }
    expect(render(createElement(PetAllowanceField, { filters: on, onChange: noop }))).toContain(
      'aria-checked="true"',
    )

    const other: PlaceFilters = { ...DEFAULT_PLACE_FILTERS, petAllowanceType: 'NOT_ALLOWED' }
    expect(render(createElement(PetAllowanceField, { filters: other, onChange: noop }))).toContain(
      'aria-checked="false"',
    )
  })
})

describe('ContentTypeField — 백엔드가 단일 파라미터라 배타 축이다', () => {
  it('radiogroup 으로 나간다 — 체크박스로 그려 놓고 하나만 먹으면 컨트롤이 거짓말을 한다', () => {
    const markup = render(
      createElement(ContentTypeField, { filters: DEFAULT_PLACE_FILTERS, onChange: noop }),
    )

    expect(markup).toContain('role="radiogroup"')
    expect(markup).toContain('role="radio"')
    expect(markup).not.toContain('role="checkbox"')
  })

  it('선택이 없으면 "전체" 가 켜진다 — 아무것도 안 켜진 라디오 그룹을 만들지 않는다', () => {
    const markup = render(
      createElement(ContentTypeField, { filters: DEFAULT_PLACE_FILTERS, onChange: noop }),
    )

    expect(checkedLabel(markup)).toBe(messages.place.filterAll)
  })
})

describe('IndoorField — 모르는 장소가 사라지는 것을 말한다', () => {
  it('전체 · 실내만 · 야외만 세 갈래다', () => {
    const markup = render(
      createElement(IndoorField, { filters: DEFAULT_PLACE_FILTERS, onChange: noop }),
    )

    expect(markup).toContain('실내만')
    expect(markup).toContain('야외만')
  })

  it('indoor 가 null 인 장소가 어느 쪽에도 안 잡히는 것을 안내한다', () => {
    expect(
      render(createElement(IndoorField, { filters: DEFAULT_PLACE_FILTERS, onChange: noop })),
    ).toContain(messages.place.filterIndoorUnknownNote)
  })

  /** `SliceResponse` 도 facet API 도 건수를 주지 않는다. 아트보드의 "7곳" 은 지어낼 수 없다 */
  it('안내 문구에 건수를 넣지 않는다', () => {
    expect(messages.place.filterIndoorUnknownNote).not.toMatch(/\d+곳/)
  })

  it('false 와 null 을 구분한다 — 야외만과 전체는 다른 상태다', () => {
    const outdoor = render(
      createElement(IndoorField, {
        filters: { ...DEFAULT_PLACE_FILTERS, indoor: false },
        onChange: noop,
      }),
    )

    // 세 옵션 중 켜진 것은 하나뿐이고 그것이 "야외만" 이다
    expect(outdoor.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(checkedLabel(outdoor)).toBe('야외만')
  })
})

describe('PetSizeField — 화자를 반려견으로 유지한다', () => {
  it('반려견 이름과 크기로 말한다 — "소형견만" 같은 추상 조건을 쓰지 않는다', () => {
    const markup = render(
      createElement(PetSizeField, { filters: DEFAULT_PLACE_FILTERS, onChange: noop, pet }),
    )

    expect(markup).toContain('몽실이(소형견)가 들어갈 수 있는 곳만')
  })

  it('반려견이 없으면 컨트롤을 렌더하지 않는다', () => {
    expect(
      render(
        createElement(PetSizeField, { filters: DEFAULT_PLACE_FILTERS, onChange: noop, pet: null }),
      ),
    ).toBe('')
  })

  /** 서버가 모르는 코드를 보내면 400 이다. 렌더하지 않는 쪽이 안전하다 */
  it('모르는 크기 코드면 렌더하지 않는다', () => {
    const unknown: Pet = {
      ...pet,
      sizeType: { code: 'GIANT', name: '초대형견', description: null },
    }

    expect(
      render(
        createElement(PetSizeField, {
          filters: DEFAULT_PLACE_FILTERS,
          onChange: noop,
          pet: unknown,
        }),
      ),
    ).toBe('')
  })

  /**
   * 제목을 밖에서 그리면 컨트롤이 사라졌을 때 제목만 남아 빈 절이 된다
   * (375 실렌더에서 실제로 그렇게 나왔다).
   */
  it('heading 을 주면 제목까지 함께 그린다', () => {
    const markup = render(
      createElement(PetSizeField, {
        filters: DEFAULT_PLACE_FILTERS,
        onChange: noop,
        pet,
        heading: messages.place.filterPetSizeLabel,
      }),
    )

    expect(markup).toContain(messages.place.filterPetSizeLabel)
  })

  it('heading 을 줘도 반려견이 없으면 제목까지 통째로 사라진다', () => {
    expect(
      render(
        createElement(PetSizeField, {
          filters: DEFAULT_PLACE_FILTERS,
          onChange: noop,
          pet: null,
          heading: messages.place.filterPetSizeLabel,
        }),
      ),
    ).toBe('')
  })
})
