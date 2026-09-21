import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { PlanStatusTabs } from '@/features/plan/plan-filter-controls'
import { expectSingleTabStop } from '@/test/radio-group'
import { DEFAULT_PLAN_FILTERS, type PlanFilters } from '@/types/plan'

function render(filters: PlanFilters): string {
  return renderToStaticMarkup(
    createElement(PlanStatusTabs, { filters, onChange: vi.fn(), statusCounts: null }),
  )
}

/**
 * 상태 탭의 키보드 계약 — [#825](https://github.com/8llow8llowMe/hondigagae/issues/825).
 *
 * **밑줄 탭처럼 보이지만 의미는 라디오다** (컴포넌트 주석). 그래서 탭 패턴이 아니라 라디오
 * 그룹 규약을 따른다 — 화살표가 이동과 선택을 함께 한다.
 */
describe('PlanStatusTabs — 키보드 (#825)', () => {
  it('radiogroup 으로 나간다', () => {
    expect(render(DEFAULT_PLAN_FILTERS)).toContain('role="radiogroup"')
  })

  it('고른 칸만 탭 스톱이다', () => {
    expectSingleTabStop(render(DEFAULT_PLAN_FILTERS))
  })

  it('고른 칸이 바뀌면 탭 스톱도 따라간다', () => {
    expectSingleTabStop(render({ ...DEFAULT_PLAN_FILTERS, status: 'COMPLETED' }))
  })
})
