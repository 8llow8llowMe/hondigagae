import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { EmergencyFilterRail } from '@/features/emergency/emergency-filter-rail'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

const COUNTS = {
  all: 12,
  byType: { ANIMAL_HOSPITAL: 7, ANIMAL_PHARMACY: 5 },
  open24: 3,
  openNow: 8,
}

function render(filters: FacilityFilters, radius = 10000) {
  return renderToStaticMarkup(
    createElement(EmergencyFilterRail, {
      filters,
      onFiltersChange: vi.fn(),
      radius,
      onRadiusChange: vi.fn(),
      counts: COUNTS,
      showCounts: true,
    }),
  )
}

describe('EmergencyFilterRail — 데스크톱 필터 레일 (#419)', () => {
  it('네 축을 모두 그린다 — 반경 · 유형 · 영업 조건', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS)

    expect(markup).toContain('시설 유형')
    expect(markup).toContain('영업 조건')
    expect(markup).toContain('10.0km')
  })

  /* `/places` 레일과 같은 규칙 — 걸린 필터가 없으면 누를 수 없는 버튼을 남기지 않는다 */
  it('걸린 조건이 없으면 초기화를 내지 않는다', () => {
    expect(render(DEFAULT_FACILITY_FILTERS)).not.toContain('초기화')
  })

  it('조건이 걸리면 초기화가 나온다', () => {
    expect(render({ ...DEFAULT_FACILITY_FILTERS, openNowOnly: true })).toContain('초기화')
  })

  /*
    **반경은 초기화 대상이 아니다** — 필터가 아니라 조회 파라미터다. 넓혀 찾던 사용자가
    조건 하나를 끄려다 결과를 통째로 잃으면 안 된다 (`EmergencyBoardParams` 의 구분).
  */
  it('반경만 기본값과 달라도 초기화를 내지 않는다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS, 40000)

    expect(markup).toContain('40.0km')
    expect(markup).not.toContain('초기화')
  })

  /* 레일 인셋 규약(`.filter-rail`)을 타는 컨테이너여야 왼쪽 기준선 40 에 선다 (#386) */
  it('filter-rail 컨테이너를 쓴다', () => {
    expect(render(DEFAULT_FACILITY_FILTERS)).toContain('filter-rail')
  })
})
