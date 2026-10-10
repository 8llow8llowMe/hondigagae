import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PLAN_PACKING_ANCHOR_ID } from '@/features/plan/plan-detail-section'
import { PlanPackingStrip } from '@/features/plan/plan-packing-strip'
import { messages } from '@/lib/messages'

/**
 * 준비물이 빈 채로 출발이 가까울 때 개요 아래에 서는 한 줄 (#732 · 진단 665-3).
 *
 * #665 는 시간만 보고 카드를 올렸고, 그 카드가 비어 있을 때도 올렸다 — 승격의 보상이
 * "빈 상태를 더 잘 보이는 자리로 옮긴 것" 이 됐다.
 */
describe('PlanPackingStrip', () => {
  const markup = renderToStaticMarkup(
    createElement(PlanPackingStrip, { targetId: PLAN_PACKING_ANCHOR_ID }),
  )

  it('같은 페이지의 준비물 카드를 가리킨다 — 다른 화면으로 보내지 않는다', () => {
    expect(markup).toContain(`href="#${PLAN_PACKING_ANCHOR_ID}"`)
  })

  it('한 줄이고 카드가 아니다 — 진입점은 남기고 면적은 주지 않는다', () => {
    expect(markup).not.toContain('<section')
    expect(markup).not.toContain('rounded-lg')
  })

  it('44px 터치 영역을 갖는다', () => {
    expect(markup).toContain('min-h-11')
  })

  /* 승격 창은 `D-1` 과 출발 당일 둘이라 하루를 못박으면 당일 화면에서 거짓말이 된다 */
  it('하루를 못박지 않는다', () => {
    expect(markup).toContain(messages.plan.packingPromptTitle)
    expect(markup).not.toContain('내일')
  })
})
