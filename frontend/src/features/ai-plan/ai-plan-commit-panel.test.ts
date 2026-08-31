import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  AiPlanCommitPanel,
  type AiPlanCommitPanelProps,
} from '@/features/ai-plan/ai-plan-commit-panel'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

function render(overrides: Partial<AiPlanCommitPanelProps> = {}) {
  const props: AiPlanCommitPanelProps = {
    title: '몽실이와 제주 2박 3일',
    errors: NO_FORM_ERRORS,
    submitting: false,
    delistedBlocked: false,
    excludedCount: 0,
    onTitleChange: () => undefined,
    onSubmit: () => undefined,
    onExcludeDelisted: () => undefined,
    onResetExcluded: () => undefined,
    onDiscard: () => undefined,
    againHref: '/ai-plans/new?from=job-1',
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanCommitPanel, props))
}

describe('AiPlanCommitPanel — 세 갈래 (아트보드 03 하단 바)', () => {
  it('담기 · 전체 다시 만들기 · 버리기를 준다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.commitSubmit)
    expect(html).toContain(messages.aiPlan.commitAgain)
    expect(html).toContain(messages.aiPlan.commitDiscard)
  })

  it('저장 시점을 다시 말한다 — 담기가 곧 초안 생성이다', () => {
    expect(render()).toContain(messages.aiPlan.commitHint)
  })

  it('제목 기본값을 채워 둔다 — 빈 칸을 마주하게 하지 않는다 (명세 S8 미결 1)', () => {
    expect(render()).toContain('몽실이와 제주 2박 3일')
  })

  it('제목을 60자로 제한한다 (PLAN_104)', () => {
    expect(render()).toContain('maxLength="60"')
  })

  it('담는 중에는 버튼을 잠근다', () => {
    expect(render({ submitting: true })).toContain('aria-busy="true"')
  })
})

describe('AiPlanCommitPanel — PLAN_004 (명세 S5 함정 3)', () => {
  it('막히면 항목을 빼고 담으라고 안내한다', () => {
    const html = render({ delistedBlocked: true })

    expect(html).toContain(messages.aiPlan.commitDelistedTitle)
    expect(html).toContain(messages.aiPlan.commitDelistedAction)
  })

  it('`다시 시도` 를 주지 않는다 — 같은 본문을 다시 보내면 같은 400 이다', () => {
    const html = render({ delistedBlocked: true })

    expect(html).not.toContain(messages.common.retry)
    expect(html).not.toContain('다시 시도')
  })

  it('서버 문구와 전용 안내를 겹쳐 내지 않는다', () => {
    const html = render({
      delistedBlocked: true,
      errors: { fields: {}, form: '일부 장소를 담을 수 없습니다.' },
    })

    expect(html).not.toContain('일부 장소를 담을 수 없습니다.')
    expect(html).toContain(messages.aiPlan.commitDelistedTitle)
  })

  it('막히지 않았으면 폼 오류를 그대로 낸다', () => {
    const html = render({ errors: { fields: {}, form: '요청 값이 올바르지 않습니다.' } })

    expect(html).toContain('role="alert"')
    expect(html).toContain('요청 값이 올바르지 않습니다.')
  })
})

describe('AiPlanCommitPanel — 빼기 표시', () => {
  it('빼기로 표시한 개수를 말하고 되돌릴 수 있게 한다', () => {
    const html = render({ excludedCount: 2 })

    expect(html).toContain('2개 항목을 빼고 담아요.')
    expect(html).toContain(messages.aiPlan.commitExcludedReset)
  })

  it('뺀 것이 없으면 안내를 내지 않는다', () => {
    expect(render({ excludedCount: 0 })).not.toContain('빼고 담아요.')
  })
})
