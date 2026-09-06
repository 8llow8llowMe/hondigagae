import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanProgress, type AiPlanProgressProps } from '@/features/ai-plan/ai-plan-progress'
import { messages } from '@/lib/messages'

const SERVER_DESCRIPTION = '반려견 조건에 맞는 장소를 모아 일자별로 배치하고 있습니다.'

function render(overrides: Partial<AiPlanProgressProps> = {}) {
  const props: AiPlanProgressProps = {
    status: { code: 'RUNNING', name: '생성 중', description: SERVER_DESCRIPTION },
    step: null,
    stepProgress: null,
    phase: 'normal',
    onRecheck: () => undefined,
    rechecking: false,
    onCancel: null,
    canceling: false,
    cancelFailed: false,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanProgress, props))
}

describe('AiPlanProgress — 서버 문구만 쓴다 (명세 S2 · S7)', () => {
  it('서버 status.description 을 그대로 렌더한다', () => {
    expect(render()).toContain(SERVER_DESCRIPTION)
  })

  /*
    **단계를 서버가 주기 전에는 그리지 않는다** (#250). 계약에 값이 생겼어도 화면이
    지어내지 않는다는 규칙은 그대로다 — `PENDING` 이면 `stepProgress` 가 null 이다.
  */
  it('단계 값이 없으면 단계 표시를 만들지 않는다', () => {
    const html = render()

    expect(html).not.toContain('단계')
    expect(html).not.toContain('남음')
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

describe('AiPlanProgress — 세부 단계 (#250)', () => {
  const STEP = {
    code: 'CANDIDATES',
    name: '후보 장소 수집',
    description: '여행 지역에서 반려견 동반이 확인된 장소를 모읍니다.',
  }

  it('서버가 준 n / m 과 단계 이름을 그린다', () => {
    const html = render({ step: STEP, stepProgress: { order: 2, total: 4 } })

    expect(html).toContain('2 / 4단계')
    expect(html).toContain(STEP.name)
  })

  /*
    **단계 설명이 상태 설명보다 정확하다.** `status.description` 은 "생성 중" 전체를,
    `step.description` 은 지금 하는 일을 말한다. 둘 다 서버 문구다.
  */
  it('단계 설명이 있으면 그것을 본문으로 쓴다', () => {
    const html = render({ step: STEP, stepProgress: { order: 2, total: 4 } })

    expect(html).toContain(STEP.description)
    expect(html).not.toContain(SERVER_DESCRIPTION)
  })

  /*
    **총 단계 수를 화면이 적지 않는다.** 백엔드가 단계를 늘리면 이 숫자도 함께 늘어야
    한다 — 상수로 박아 두면 `5 / 4 단계` 가 나간다.
  */
  it('총 단계 수는 서버 값을 따른다', () => {
    expect(render({ stepProgress: { order: 5, total: 6 } })).toContain('5 / 6단계')
  })

  it('단계 표시도 aria-live 영역 안에 있다 — 진행을 낭독해야 한다', () => {
    const html = render({ step: STEP, stepProgress: { order: 2, total: 4 } })
    const liveRegion = html.slice(html.indexOf('aria-live'))

    expect(liveRegion).toContain('2 / 4단계')
  })
})

describe('AiPlanProgress — 그만두기 (#250)', () => {
  it('onCancel 이 없으면 버튼을 그리지 않는다', () => {
    expect(render()).not.toContain(messages.aiPlan.jobCancel)
  })

  it('onCancel 이 있으면 버튼과 한계 안내를 함께 그린다', () => {
    const html = render({ onCancel: () => undefined })

    expect(html).toContain(messages.aiPlan.jobCancel)
    // 협조적 취소라 즉시 멈추지 않는다는 것을 누르기 전에 말한다
    expect(html).toContain(messages.aiPlan.jobCancelHint)
  })

  /*
    **상한을 넘긴 화면에서야말로 그만둘 이유가 크다.** 이 화면을 벗어나는 것으로는
    작업이 멈추지 않는다.
  */
  it('상한 초과 화면에도 그만두기가 있다', () => {
    const html = render({ phase: 'exceeded', onCancel: () => undefined })

    expect(html).toContain(messages.aiPlan.jobCancel)
    expect(html).toContain(messages.aiPlan.jobExceededAction)
  })

  it('취소 요청이 실패하면 진행 표시를 유지한 채 이유를 말한다', () => {
    const html = render({ onCancel: () => undefined, cancelFailed: true })

    expect(html).toContain(messages.aiPlan.jobCancelFailed)
    // 작업은 계속 돌고 있다 — 진행 표시를 걷지 않는다
    expect(html).toContain(SERVER_DESCRIPTION)
  })
})
