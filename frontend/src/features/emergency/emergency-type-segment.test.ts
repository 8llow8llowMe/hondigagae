import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { EmergencyTypeSegment } from '@/features/emergency/emergency-type-segment'
import { expectSingleTabStop } from '@/test/radio-group'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

function render(filters: FacilityFilters): string {
  return renderToStaticMarkup(
    createElement(EmergencyTypeSegment, {
      filters,
      onFiltersChange: vi.fn(),
      counts: { all: 12, byType: {} },
      showCounts: false,
    }),
  )
}

/**
 * 유형 세그먼트의 키보드 계약 — [#825](https://github.com/8llow8llowMe/hondigagae/issues/825).
 *
 * 코스 목록 세그먼트가 이 컴포넌트에서 문법을 가져왔다([#537](https://github.com/8llow8llowMe/hondigagae/issues/537))
 * — 한쪽만 고치면 같은 문법인데 화면마다 키보드가 다르게 동작한다.
 */
describe('EmergencyTypeSegment — 키보드 (#825)', () => {
  it('radiogroup 으로 나간다', () => {
    expect(render(DEFAULT_FACILITY_FILTERS)).toContain('role="radiogroup"')
  })

  it('고른 칸만 탭 스톱이다', () => {
    expectSingleTabStop(render(DEFAULT_FACILITY_FILTERS))
  })

  it('고른 칸이 바뀌면 탭 스톱도 따라간다', () => {
    expectSingleTabStop(render({ ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_HOSPITAL' }))
  })
})
