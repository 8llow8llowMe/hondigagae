import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanCreateSheet } from '@/features/plan/plan-create-sheet'
import { messages } from '@/lib/messages'

function render(open: boolean) {
  return renderToStaticMarkup(createElement(PlanCreateSheet, { open, onClose: () => undefined }))
}

describe('PlanCreateSheet — AI 화면이 생겨 항목이 둘이 됐다 (이슈 #84)', () => {
  it('닫혀 있으면 아무것도 렌더하지 않는다', () => {
    expect(render(false)).toBe('')
  })

  it('AI 로 만들기와 직접 만들기 두 갈래를 준다', () => {
    const html = render(true)

    expect(html).toContain(messages.plan.createSheetAi)
    expect(html).toContain(messages.plan.createSheetManual)
  })

  it('각 갈래가 무엇인지 한 줄로 설명한다', () => {
    const html = render(true)

    expect(html).toContain(messages.plan.createSheetAiDescription)
    expect(html).toContain(messages.plan.createSheetManualDescription)
  })

  it('두 항목 모두 이동이라 링크다 — Button 이 아니다 (#70)', () => {
    const html = render(true)

    expect(html).toContain('href="/ai-plans/new"')
    expect(html).toContain('href="/plans/new"')
  })

  it('시트 제목을 낸다', () => {
    expect(render(true)).toContain(messages.plan.createSheetTitle)
  })
})
