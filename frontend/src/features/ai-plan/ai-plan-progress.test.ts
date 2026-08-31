import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanProgress, type AiPlanProgressProps } from '@/features/ai-plan/ai-plan-progress'
import { messages } from '@/lib/messages'

const SERVER_DESCRIPTION = '반려견 조건에 맞는 장소를 모아 일자별로 배치하고 있습니다.'

function render(overrides: Partial<AiPlanProgressProps> = {}) {
  const props: AiPlanProgressProps = {
    status: { code: 'RUNNING', name: '생성 중', description: SERVER_DESCRIPTION },
    phase: 'normal',
    onRecheck: () => undefined,
    rechecking: false,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanProgress, props))
}

describe('AiPlanProgress — 서버 문구만 쓴다 (명세 S2 · S7)', () => {
  it('서버 status.description 을 그대로 렌더한다', () => {
    expect(render()).toContain(SERVER_DESCRIPTION)
  })

  it('진행 단계 목록이나 남은 시간을 만들지 않는다 — 계약에 없다', () => {
    const html = render()

    expect(html).not.toContain('단계')
    expect(html).not.toContain('남음')
    expect(html).not.toContain('취소')
  })

  it('서버가 설명을 주지 않으면 대체 문구를 쓴다', () => {
    const html = render({ status: { code: 'PENDING', name: '대기 중', description: null } })
    expect(html).toContain(messages.aiPlan.jobProgressFallback)
  })

  it('첫 응답 전에도 화면이 비지 않는다', () => {
    expect(render({ status: null })).toContain(messages.aiPlan.jobProgressFallback)
  })

  it('상태 변화를 스크린리더가 알 수 있게 aria-live 를 건다', () => {
    expect(render()).toContain('aria-live="polite"')
  })
})

describe('AiPlanProgress — 폴링 국면 (명세 S4)', () => {
  it('30초 전에는 기다림에 대해 아무 말도 하지 않는다', () => {
    expect(render({ phase: 'normal' })).not.toContain(messages.aiPlan.jobSlowNotice)
  })

  it('30초를 넘기면 안내를 덧붙인다', () => {
    const html = render({ phase: 'slow' })

    expect(html).toContain(messages.aiPlan.jobSlowNotice)
    // 진행 표시 자체는 그대로 남는다
    expect(html).toContain(SERVER_DESCRIPTION)
  })

  it('90초를 넘기면 진행 표시를 걷고 수동 확인을 준다', () => {
    const html = render({ phase: 'exceeded' })

    expect(html).toContain(messages.aiPlan.jobExceededTitle)
    expect(html).toContain(messages.aiPlan.jobExceededAction)
    expect(html).not.toContain(SERVER_DESCRIPTION)
  })

  it('상한 초과는 실패가 아니다 — 오류 문구를 쓰지 않는다', () => {
    const html = render({ phase: 'exceeded' })

    expect(html).not.toContain(messages.aiPlan.failedTitle)
    expect(html).not.toContain(messages.common.temporaryErrorDescription)
  })
})
