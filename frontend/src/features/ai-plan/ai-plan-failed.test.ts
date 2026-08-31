import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanFailed, type AiPlanFailedProps } from '@/features/ai-plan/ai-plan-failed'
import { messages } from '@/lib/messages'

const SERVER_MESSAGE = '여행 일정에 넣을 반려견 동반 가능 장소를 찾지 못했습니다.'

function render(overrides: Partial<AiPlanFailedProps> = {}) {
  const props: AiPlanFailedProps = {
    errorMessage: SERVER_MESSAGE,
    conditionSummary: '2026-09-12 (토) – 09-14 (월) · 몽실이 · 30만원',
    onRetry: () => undefined,
    retrying: false,
    changeHref: '/ai-plans/new?from=job-1',
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanFailed, props))
}

describe('AiPlanFailed — 5xx 화면과 다르게 다룬다 (명세 S7)', () => {
  it('서버 errorMessage 를 그대로 렌더한다', () => {
    expect(render()).toContain(SERVER_MESSAGE)
  })

  it('"일시 장애" 문구를 쓰지 않는다 — HTTP 200 이고 조건 문제일 수 있다', () => {
    const html = render()

    expect(html).not.toContain(messages.common.temporaryErrorDescription)
    expect(html).not.toContain('일시')
  })

  it('세 갈래를 준다 — 재시도 · 조건 바꾸기 · 직접 만들기', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.failedRetry)
    expect(html).toContain(messages.aiPlan.failedChange)
    expect(html).toContain(messages.aiPlan.failedManual)
  })

  it('조건 바꾸기는 그 작업의 조건을 되살리는 주소로 간다', () => {
    expect(render()).toContain('/ai-plans/new?from=job-1')
  })

  it('입력 조건을 그대로 남긴다고 말한다', () => {
    expect(render()).toContain('몽실이 · 30만원')
  })

  it('서버가 사유를 주지 않으면 대체 문구를 쓴다', () => {
    expect(render({ errorMessage: null })).toContain(messages.aiPlan.failedFallback)
  })
})

describe('AiPlanFailed — 조건을 잃은 경우', () => {
  it('조건이 없으면 재시도를 주지 않는다 — 같은 요청을 만들 수 없다', () => {
    const html = render({ onRetry: null, conditionSummary: null })

    expect(html).not.toContain(messages.aiPlan.failedRetry)
    // 나머지 두 갈래는 남는다
    expect(html).toContain(messages.aiPlan.failedChange)
    expect(html).toContain(messages.aiPlan.failedManual)
  })

  it('조건이 없으면 "그대로 남아 있어요" 를 말하지 않는다', () => {
    const html = render({ onRetry: null, conditionSummary: null })
    expect(html).not.toContain('그대로 남아 있어요')
  })
})
