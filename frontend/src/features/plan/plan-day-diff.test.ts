import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayDiff, type PlanDayDiffRow } from '@/features/plan/plan-day-diff'
import { messages } from '@/lib/messages'

const CURRENT: PlanDayDiffRow[] = [
  { title: '제주특별자치도립김창열미술관', caption: '제주시 한림읍 · 실내' },
  { title: '동문재래시장', caption: '제주시 · 야외' },
]

const NEXT: PlanDayDiffRow[] = [
  { title: '오설록 티뮤지엄 카페', caption: '서귀포시 안덕면 · 실내' },
  { title: '사려니숲길 산책', caption: null },
]

function render(overrides: Partial<Parameters<typeof PlanDayDiff>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayDiff, { current: CURRENT, next: NEXT, ...overrides }),
  )
}

describe('PlanDayDiff', () => {
  it('양쪽 제목을 모두 낸다', () => {
    const markup = render()

    expect(markup).toContain('제주특별자치도립김창열미술관')
    expect(markup).toContain('오설록 티뮤지엄 카페')
  })

  it('두 열의 이름을 낸다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.regenerateDayCurrent)
    expect(markup).toContain(messages.plan.regenerateDayNext)
  })

  it('caption 이 null 이면 그 줄만 빠지고 제목은 남는다', () => {
    expect(render()).toContain('사려니숲길 산책')
  })

  /*
    R5. 항목이 0개인 날에도 진입점이 있으므로 "지금" 이 비는 경우가 실제로 생긴다.
    비었다고 말하고 넘어간다 — 그 상태가 사실이다.
  */
  it('지금이 비면 빈 안내를 낸다', () => {
    const markup = render({ current: [] })

    expect(markup).toContain(messages.plan.regenerateDayEmpty)
    expect(markup).toContain('오설록 티뮤지엄 카페')
  })

  it('순서를 1부터 매겨 보여 준다', () => {
    const markup = render()

    expect(markup).toContain('>1<')
    expect(markup).toContain('>2<')
  })
})
