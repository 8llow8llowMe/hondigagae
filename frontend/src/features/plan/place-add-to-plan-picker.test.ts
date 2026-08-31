import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  type AddToPlanDayOption,
  PlaceAddToPlanPicker,
} from '@/features/plan/place-add-to-plan-picker'
import { messages } from '@/lib/messages'
import type { PlanSummaryItem } from '@/types/plan'

function plan(planId: string, title: string): PlanSummaryItem {
  return {
    planId,
    petId: 'pet-1',
    areaCode: '39',
    title,
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    status: { code: 'DRAFT', name: '초안', description: null },
  }
}

const PLANS = [plan('1', '몽실이와 제주 2박 3일'), plan('2', '초코와 가을 서귀포')]

const DAYS: AddToPlanDayOption[] = [
  { day: 1, date: '2026-09-12', itemCount: 3, already: false },
  { day: 2, date: '2026-09-13', itemCount: 2, already: false },
  { day: 3, date: '2026-09-14', itemCount: 1, already: true },
]

function render(overrides: Partial<Parameters<typeof PlaceAddToPlanPicker>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlaceAddToPlanPicker, {
      plans: PLANS,
      selectedPlanId: null,
      onSelectPlan: () => undefined,
      days: [],
      daysLoading: false,
      selectedDay: null,
      onSelectDay: () => undefined,
      ...overrides,
    }),
  )
}

describe('일정 → 일자, 한 시트에서 (아트보드 02-A)', () => {
  it('고르기 전에는 일자 버튼이 없다', () => {
    const markup = render()

    expect(markup).toContain('몽실이와 제주 2박 3일')
    expect(markup).not.toContain(messages.plan.addToPlanDayTitle)
  })

  it('고른 일정 아래에만 일자가 펼쳐진다 — 다른 일정 아래에는 없다', () => {
    const markup = render({ selectedPlanId: '1', days: DAYS })

    expect(markup).toContain(messages.plan.addToPlanDayTitle)
    // 일자 블록이 하나뿐이다 — 두 일정 모두에 펼치면 어느 일정의 일자인지 흐려진다
    expect(markup.split(messages.plan.addToPlanDayTitle).length - 1).toBe(1)
  })

  it('고른 일정을 aria-pressed 로 말한다 — 배경 tint 만으로는 부족하다', () => {
    expect(render({ selectedPlanId: '1', days: DAYS })).toContain('aria-pressed="true"')
  })
})

describe('일자 버튼 — 그날 항목 수로 몰림을 알린다', () => {
  it('날짜와 항목 수를 함께 쓴다', () => {
    const markup = render({ selectedPlanId: '1', days: DAYS })

    expect(markup).toContain('09-12 · 3곳')
    expect(markup).toContain('09-13 · 2곳')
  })

  it('기간을 못 읽으면 일차와 항목 수만 쓴다 — 날짜를 지어내지 않는다', () => {
    const markup = render({
      selectedPlanId: '1',
      days: [{ day: 1, date: null, itemCount: 0, already: false }],
    })

    expect(markup).toContain('0곳')
    expect(markup).not.toContain('null')
  })

  it('이미 담긴 일자를 잠그지 않는다 — 같은 곳을 다른 날 또 들를 수 있다', () => {
    const markup = render({ selectedPlanId: '1', days: DAYS })

    expect(markup).toContain(messages.plan.addPlaceAlready)
    expect(markup).not.toContain('disabled')
  })
})

describe('일자 조회 중', () => {
  it('빈 일자 목록 대신 조회 중임을 말한다 — 0일짜리 일정으로 읽히면 안 된다', () => {
    const markup = render({ selectedPlanId: '1', days: [], daysLoading: true })

    expect(markup).toContain(messages.common.loading)
  })
})
