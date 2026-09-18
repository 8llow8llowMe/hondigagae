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

/** 마크업에 그 조각이 몇 번 나오는가 — 눈금 칸처럼 개수가 곧 계약인 것을 센다 */
function count(html: string, needle: string): number {
  return html.split(needle).length - 1
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
  it('안내 시점 전에는 기다림에 대해 아무 말도 하지 않는다', () => {
    expect(render({ phase: 'normal' })).not.toContain(messages.aiPlan.jobSlowNotice)
  })

  it('안내 시점을 넘기면 안내를 덧붙인다', () => {
    const html = render({ phase: 'slow' })

    expect(html).toContain(messages.aiPlan.jobSlowNotice)
    // 진행 표시 자체는 그대로 남는다
    expect(html).toContain(SERVER_DESCRIPTION)
  })

  it('상한을 넘기면 진행 표시를 걷고 수동 확인을 준다', () => {
    const html = render({ phase: 'exceeded' })

    expect(html).toContain(messages.aiPlan.jobExceededTitle)
    expect(html).toContain(messages.aiPlan.jobExceededAction)
    expect(html).not.toContain(SERVER_DESCRIPTION)
  })

  /*
    **설명문은 "작업이 계속되고 있다" 를 말하는 유일한 자리다** (#495). 제목과 버튼만
    단언하면 이 `<p>` 를 지워도 초록불이라, 화면이 멈춘 것을 본 사람에게 작업도 멈췄다는
    오해를 남긴 채 통과한다.
  */
  it('상한을 넘겨도 작업이 계속되고 있다고 말한다', () => {
    expect(render({ phase: 'exceeded' })).toContain(messages.aiPlan.jobExceededDescription)
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

describe('AiPlanProgress — 경과 시간 (#710)', () => {
  /*
    **`4 / 4단계` 하나로는 기다리는 구간에서 화면이 아무 말도 하지 않는다.** 네 단계 중
    `DRAFTING`(LLM 호출)이 전체의 90% 이상이라 사람이 보는 거의 모든 시간이 마지막 한
    칸이고, 그 동안 숫자가 멈춰 있다.
  */
  it('경과 시간과 예상 시간을 함께 말한다', () => {
    const html = render({ elapsedMs: 72_000 })

    expect(html).toContain('1분 12초')
    expect(html).toContain('1~2분')
  })

  it('값을 받지 못하면 그 줄이 없다', () => {
    expect(render()).not.toContain('지남')
  })

  /*
    **1초마다 바뀌는 값이라 낭독 영역 밖이어야 한다.** 안에 있으면 스크린리더가 매 초
    읽고, 그 소음에 정작 바뀐 단계 이름이 묻힌다. 이 화면에서 `aria-live` 영역은 하나이므로
    그 뒤를 보면 밖인지 알 수 있다.
  */
  it('경과 시간을 낭독하지 않는다', () => {
    const html = render({ elapsedMs: 72_000, stepProgress: { order: 4, total: 4 } })

    /*
      **값을 담은 요소 자체가 `aria-hidden` 이어야 한다.** 낭독 영역 밖에 두는 것만으로는
      부족하다 — 나중에 누가 이 줄을 `role="status"` 안으로 옮기면 그날부터 매 초 읽힌다.
    */
    expect(html).toMatch(/<p aria-hidden="true"[^>]*>1분 12초 지남/)
  })

  it('상한 초과 화면에서도 얼마나 기다렸는지 말한다', () => {
    expect(render({ phase: 'exceeded', elapsedMs: 330_000 })).toContain('5분 30초')
  })
})

describe('AiPlanProgress — 단계 눈금 (#710)', () => {
  /*
    **칸 수는 서버가 준 `total` 이다.** 상수로 박으면 백엔드가 단계를 늘릴 때 눈금과
    `n / m단계` 가 어긋난다 — 같은 값을 두 번 적지 않는다는 규칙(#250)이 눈금에도 적용된다.
  */
  it('총 단계 수만큼 칸을 그린다', () => {
    const five = render({ stepProgress: { order: 2, total: 5 } })
    const four = render({ stepProgress: { order: 2, total: 4 } })

    expect(count(five, 'rounded-full')).toBe(5)
    expect(count(four, 'rounded-full')).toBe(4)
  })

  /*
    **지나간 칸과 지금 칸이 갈려야 `4 / 4` 가 "끝났는데 멈췄다" 로 읽히지 않는다.**
    앞의 셋이 채워져 있으면 같은 숫자가 "마지막 하나를 하고 있다" 가 된다.
  */
  it('지나간 칸·지금 칸·남은 칸을 구분한다', () => {
    const html = render({ stepProgress: { order: 4, total: 4 } })

    expect(count(html, 'rounded-full bg-fg"')).toBe(3)
    expect(count(html, 'animate-pulse')).toBe(1)
  })

  it('첫 단계에서는 채운 칸이 없다', () => {
    const html = render({ stepProgress: { order: 1, total: 4 } })

    expect(count(html, 'rounded-full bg-fg"')).toBe(0)
    expect(count(html, 'rounded-full bg-band')).toBe(3)
  })

  /* 단계가 없으면 눈금도 없다 — `PENDING` 에서 0칸을 그리면 시작한 것으로 보인다 */
  it('단계 값이 없으면 눈금을 그리지 않는다', () => {
    expect(count(render(), 'rounded-full')).toBe(0)
  })

  /*
    **스켈레톤을 걷었다.** 완료되면 `bare` 로 빠져 전혀 다른 카드 여럿이 뜨므로 "이 모양이
    곧 온다" 는 약속이 애초에 참이 아니었고, `prefers-reduced-motion` 에서는 정지한 회색
    덩어리였다.
  */
  it('초안 자리를 흉내 내는 스켈레톤이 없다', () => {
    expect(render({ stepProgress: { order: 4, total: 4 } })).not.toContain('h-16 w-full')
  })
})

describe('AiPlanProgress — 조건 블록 (#710)', () => {
  const SUMMARY = '2026-09-18 (금) – 09-20 (일) · 몽'

  /* 기다리는 동안이야말로 "지금 뭘 만들고 있나" 가 궁금하다 */
  it('무엇을 만들고 있는지 보여 준다', () => {
    const html = render({ conditionSummary: SUMMARY })

    expect(html).toContain(messages.aiPlan.jobConditionLabel)
    expect(html).toContain(SUMMARY)
  })

  /* 다른 기기에서 같은 주소를 열면 실제로 이 상태가 된다 (명세 S5 함정 1) */
  it('조건을 잃으면 라벨째 그리지 않는다', () => {
    expect(render()).not.toContain(messages.aiPlan.jobConditionLabel)
  })
})
