import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { NarrowFields, RadiusField, TypeField } from '@/features/emergency/emergency-filter-fields'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

const COUNTS = {
  all: 12,
  byType: { ANIMAL_HOSPITAL: 7, ANIMAL_PHARMACY: 5 },
  open24: 3,
  openNow: 8,
}

function renderType(filters: FacilityFilters, showCounts = true) {
  return renderToStaticMarkup(
    createElement(TypeField, { filters, onChange: vi.fn(), counts: COUNTS, showCounts }),
  )
}

describe('TypeField — 유형 축 (#419)', () => {
  it('전체와 유형 두 갈래를 라디오로 그린다', () => {
    const markup = renderType(DEFAULT_FACILITY_FILTERS)

    expect(markup).toContain('전체')
    expect(markup).toContain('병원')
    expect(markup).toContain('약국')
  })

  it('개수를 라벨에 붙인다 — 칩과 같은 labelWithCount 를 쓴다', () => {
    expect(renderType(DEFAULT_FACILITY_FILTERS)).toContain('12')
  })

  /*
    **잘린 목록에서 센 개수는 전체가 아니다** (`countsAreComplete`). 칩이 지키는 규칙을
    레일도 지켜야 한다 — 두 표면이 같은 배열을 세면서 한쪽만 숫자를 감추면 안 된다.
  */
  it('showCounts 가 false 면 숫자를 빼고 라벨만 남긴다', () => {
    const markup = renderType(DEFAULT_FACILITY_FILTERS, false)

    expect(markup).toContain('병원')
    expect(markup).not.toContain('12')
  })
})

describe('NarrowFields — 영업 조건 (#419)', () => {
  const render = (filters: FacilityFilters) =>
    renderToStaticMarkup(
      createElement(NarrowFields, {
        filters,
        onChange: vi.fn(),
        counts: COUNTS,
        showCounts: true,
      }),
    )

  it('24시간과 지금 진료중을 체크로 그린다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS)

    expect(markup).toContain('24시간')
    expect(markup).toContain('지금')
  })

  /* 백엔드 스키마가 화면에 알리라고 명시한 사실이라 칩 줄이 갖고 있던 것을 레일도 갖는다 */
  it('24시간을 켜면 안내 문장을 함께 낸다', () => {
    const on = render({ ...DEFAULT_FACILITY_FILTERS, open24Only: true })
    const off = render(DEFAULT_FACILITY_FILTERS)

    expect(on).toContain('24시간')
    expect(on.length).toBeGreaterThan(off.length)
  })
})

describe('RadiusField — 반경 (#419)', () => {
  const render = (radius: number) =>
    renderToStaticMarkup(createElement(RadiusField, { radius, onChange: vi.fn() }))

  it('반경 선택지를 라디오로 그린다', () => {
    const markup = render(10000)

    expect(markup).toContain('km')
  })

  /*
    **반경은 필터가 아니라 조회 파라미터다** — 레일에서도 `초기화` 가 건드리지 않는다.
    그 구분은 `EmergencyBoardParams` 가 반경을 `filters` 밖에 두는 것으로 이미 서 있고,
    이 필드가 `FacilityFilters` 를 아예 받지 않는 것으로 타입에서 강제한다.
  */
  it('FacilityFilters 를 받지 않는다 — 반경은 필터 축이 아니다', () => {
    expect(RadiusField.length).toBe(1)
    expect(render(20000)).not.toContain('checkbox')
  })
})
