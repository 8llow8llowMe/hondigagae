import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { UpcomingPlanRow } from '@/features/home/upcoming-plan-row'
import { messages } from '@/lib/messages'
import type { PlanSummaryItem } from '@/types/plan'

const TODAY = new Date(2026, 7, 27)

function plan(overrides: Partial<PlanSummaryItem> = {}): PlanSummaryItem {
  return {
    planId: '223456789012000001',
    petId: '123456789012000001',
    petIds: ['123456789012000001'],
    areaCode: '39',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    status: { code: 'DRAFT', name: '초안', description: null },
    ...overrides,
  }
}

function render(overrides: Partial<PlanSummaryItem> = {}) {
  return renderToStaticMarkup(
    createElement(UpcomingPlanRow, { plan: plan(overrides), today: TODAY }),
  )
}

/**
 * #561. 홈의 이 행은 `pickUpcomingPlans` 가 **종료일 기준**으로 고르므로 여행 중인 일정도
 * 올라온다. 예전에는 그때 D-day 를 말할 수 없어 기둥이 빈 채였다.
 */
describe('홈의 다가오는 일정 행', () => {
  it('아직 안 떠난 일정은 D-day 를 세운다', () => {
    expect(render()).toContain('D-16')
  })

  it('여행 중이면 기둥에 여행 중이 선다 — 자리를 비우지 않는다', () => {
    const markup = render({ startDate: '2026-08-24', endDate: '2026-08-27' })

    expect(markup).toContain(messages.plan.ongoing)
    expect(markup).not.toMatch(/D-\d/)
  })

  it('데스크톱 날짜 줄은 D-day 를 되풀이하는 자리에 며칠째인지를 적는다', () => {
    expect(render({ startDate: '2026-08-24', endDate: '2026-08-27' })).toContain('오늘 4일차')
  })

  /*
    #998. 예전에는 `{startDate} – {endDate.slice(5)}` 로 `2026-09-12 – 09-14` 를 썼다 —
    목록 행(`plan-row`)은 같은 일정을 `2026년 9월 12일 (토) – 9월 14일 (월)` 로 부른다.
    **목록 행과 같은 함수(`formatPlanDateRange`)** 라 올해 일정에도 연도가 선다.
  */
  describe('날짜 줄은 목록 행과 같은 기간 모양이다 (#998)', () => {
    it('올해 일정도 시작일에 연도를 쓰고 요일을 붙인다', () => {
      const markup = render()

      expect(markup).toContain('2026년 9월 12일 (토) – 9월 14일 (월)')
      expect(markup).not.toContain('2026-09-12')
    })

    it('해를 넘기는 일정은 종료일에도 연도를 다시 쓴다', () => {
      expect(render({ startDate: '2026-12-30', endDate: '2027-01-02' })).toContain(
        '2026년 12월 30일 (수) – 2027년 1월 2일 (토)',
      )
    })

    it('하루짜리 일정은 날짜를 한 번만 쓴다', () => {
      const markup = render({ startDate: '2026-10-03', endDate: '2026-10-03' })

      expect(markup).toContain('2026년 10월 3일 (토)')
      expect(markup).not.toContain(' – ')
    })
  })

  /*
    모바일 날짜 줄은 상태명(`초안`)이 쓰고 있어 덧말을 넣지 않는다. 되풀이 자리는 전부
    `hidden md:inline` 안에 있어야 한다 — 이 단언이 그 래핑을 잠근다.
  */
  it('며칠째인지는 데스크톱 전용이다 — 모바일 날짜 줄은 상태명 자리다', () => {
    const markup = render({ startDate: '2026-08-24', endDate: '2026-08-27' })

    expect(markup).toContain('hidden md:inline')
    expect(markup).toContain('초안')
  })
})
