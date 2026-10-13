import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  AiPlanDraftPlaceSummary,
  type DraftPlaceSummary,
} from '@/features/ai-plan/ai-plan-draft-place-sheet'
import { messages } from '@/lib/messages'
import { aiPlanItem } from '@/test/fixtures/ai-plan'

function render(overrides: Partial<DraftPlaceSummary> = {}) {
  const summary: DraftPlaceSummary = {
    item: aiPlanItem({ title: '협재해수욕장', note: '아침 산책으로 바다 감상해요' }),
    placeId: '212481712381923328',
    meta: '제주시 한림읍 · 야외',
    thumbnail: null,
    startTime: '10:00',
    delisted: false,
    excluded: false,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanDraftPlaceSummary, { summary }))
}

describe('AiPlanDraftPlaceSummary — 장소 요약 시트 본문 (#1432 · 명세 S11-2)', () => {
  it('담으면 들어갈 시각을 라벨과 함께 낸다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.placeSheetTimeLabel)
    expect(html).toContain('<time dateTime="10:00">10:00</time>')
  })

  it('AI 설명을 낸다 — 담으면 항목 메모로 들어가는 문장이다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.placeSheetNoteLabel)
    expect(html).toContain('아침 산책으로 바다 감상해요')
  })

  it('보강으로 얻은 주소 줄을 낸다 — 새 조회를 만들지 않는다', () => {
    expect(render()).toContain('제주시 한림읍 · 야외')
  })

  it('시각을 모르면(20:00 넘음) 시각 줄이 없다 — 지어내지 않는다', () => {
    expect(render({ startTime: null })).not.toContain(messages.aiPlan.placeSheetTimeLabel)
  })

  it('뺀 항목은 시각 대신 담기에서 뺐다고 말한다', () => {
    const html = render({ excluded: true })

    expect(html).toContain(messages.aiPlan.placeSheetExcluded)
    expect(html).not.toContain(messages.aiPlan.placeSheetTimeLabel)
  })

  it('조회되지 않는 장소는 배지로 지목한다', () => {
    expect(render({ delisted: true })).toContain(messages.aiPlan.itemPlaceDelisted)
  })

  it('note 가 null 이면 설명 절을 그리지 않는다 — nullable 이다', () => {
    const html = render({ item: aiPlanItem({ title: '협재해수욕장', note: null }) })

    expect(html).not.toContain(messages.aiPlan.placeSheetNoteLabel)
  })
})
