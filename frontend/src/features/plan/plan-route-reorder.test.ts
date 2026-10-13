import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDaySection } from '@/features/plan/plan-day-section'
import { messages } from '@/lib/messages'
import {
  planDayAdd,
  planDayItemTime,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 일자 카드의 동선 다시 정렬 제안 — 이슈 #1462 · 일정상세-세부명세 D31-2.
 *
 * 판정은 `route-reorder.test.ts` 가 잠근다. 여기서 보는 것은 **제안이 있을 때만 한 줄이 서고,
 * 편집 중에는 서지 않으며, 추천 순서로 연 편집기 위에 "아직 저장 전" 을 말하는가** 다.
 */
function render(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanDaySection, {
      day: 2,
      date: '2026-09-12',
      rows: [{ item: planDetail.items[0]!, distanceMeters: null, distanceKind: null }],
      places: new Map<string, PlaceDetail>(),
      verdict: undefined,
      petConditionApplied: true,
      basisPetName: null,
      verdictFailed: false,
      onRetryVerdict: () => undefined,
      editing: false,
      onStartEdit: () => undefined,
      editor: null,
      add: planDayAdd,
      visit: planDayVisit,
      walkSafety: planDayWalkSafety,
      itemTime: planDayItemTime,
      regenerateHref: null,
      ...overrides,
    }),
  )
}

const suggestion = { savedMeters: 9_300, onApply: () => undefined }

describe('PlanDaySection — 동선 다시 정렬 제안 (#1462)', () => {
  it('제안이 없으면 줄이 서지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain(messages.plan.routeReorderAction)
    expect(markup).not.toContain('되돌아가는 구간')
  })

  it('제안이 있으면 줄어드는 직선거리와 버튼이 선다', () => {
    const markup = render({ routeReorder: suggestion })

    expect(markup).toContain('되돌아가는 구간이 있어요. 순서를 바꾸면 직선 9.3km 줄어요.')
    expect(markup).toContain(`>${messages.plan.routeReorderAction}</button>`)
  })

  it('버튼의 접근 이름은 보이는 낱말로 시작하고 일자로 가른다', () => {
    expect(render({ routeReorder: suggestion })).toContain('aria-label="동선 다시 정렬, 2일차"')
  })

  it('제안 줄은 항목 목록 다음, 순서 편집 버튼 앞이다', () => {
    const markup = render({ routeReorder: suggestion })
    const notice = markup.indexOf('되돌아가는 구간')

    expect(notice).toBeGreaterThan(markup.indexOf(planDetail.items[0]!.title))
    expect(notice).toBeLessThan(markup.indexOf(messages.plan.editDayAction))
  })

  it('편집 중에는 제안 줄이 서지 않는다', () => {
    const markup = render({ routeReorder: suggestion, editing: true, editor: null })

    expect(markup).not.toContain('되돌아가는 구간')
  })

  it('추천 순서로 연 편집기 위에는 아직 저장 전이라는 줄이 선다', () => {
    const markup = render({
      editing: true,
      reorderPreview: true,
      editor: createElement('div', null, 'EDITOR'),
    })

    const notice = markup.indexOf(messages.plan.routeReorderApplied)
    expect(notice).toBeGreaterThan(-1)
    expect(notice).toBeLessThan(markup.indexOf('EDITOR'))
  })

  it('보통의 순서 편집에는 그 줄이 없다', () => {
    const markup = render({ editing: true, editor: createElement('div', null, 'EDITOR') })

    expect(markup).not.toContain(messages.plan.routeReorderApplied)
  })
})
