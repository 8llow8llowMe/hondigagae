import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanCommitBar } from '@/features/ai-plan/ai-plan-commit-bar'
import { AI_PLAN_COMMIT_FORM_ID } from '@/features/ai-plan/ai-plan-commit-panel'
import { messages } from '@/lib/messages'

/** 모바일 결과 화면의 하단 고정 `내 일정에 담기` — 이슈 #1381 */
describe('AiPlanCommitBar', () => {
  const render = (submitting = false) =>
    renderToStaticMarkup(createElement(AiPlanCommitBar, { submitting }))

  it('담기 패널의 폼을 제출하는 버튼이다 — 검증 · 오류 · 진행 표시가 한 벌이다', () => {
    const html = render()

    expect(html).toContain('type="submit"')
    expect(html).toContain(`form="${AI_PLAN_COMMIT_FORM_ID}"`)
    expect(html).toContain(messages.aiPlan.commitSubmit)
  })

  it('768 미만에만 서고, 탭바 위에 붙는 sticky 띠다', () => {
    const html = render()

    expect(html).toContain('md:hidden')
    expect(html).toContain('sticky')
    expect(html).toContain('bottom-tabbar')
  })

  it('담는 중이면 진행 표시를 낸다', () => {
    expect(render(true)).toContain('aria-busy="true"')
  })
})
