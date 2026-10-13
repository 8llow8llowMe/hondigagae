import { describe, expect, it } from 'vitest'

import { periodSummaryText } from '@/lib/ai-plan/period-label'

/** 조건 폼의 기간 안내 — `N박 M일` (#1431) */
describe('periodSummaryText', () => {
  it('이틀 이상은 N박 M일이다', () => {
    expect(periodSummaryText(3)).toBe('2박 3일이에요.')
    expect(periodSummaryText(2)).toBe('1박 2일이에요.')
  })

  /* `0박 1일` 은 아무도 그렇게 말하지 않는다 */
  it('하루면 당일치기다', () => {
    expect(periodSummaryText(1)).toBe('당일치기예요.')
  })
})
