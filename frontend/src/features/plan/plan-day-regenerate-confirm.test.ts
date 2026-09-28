import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayRegenerateConfirm } from '@/features/plan/plan-day-regenerate-confirm'
import { messages } from '@/lib/messages'

function render(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayRegenerateConfirm, {
      onApply: () => undefined,
      applying: false,
      error: null,
      // 기본은 **잃을 것이 있는 날**이다 — 항목과 다녀옴 표시가 있다 (#984)
      hasItems: true,
      hasVisited: true,
      hasStartTime: false,
      ...overrides,
    }),
  )
}

describe('PlanDayRegenerateConfirm', () => {
  /*
    R5. 계약에 일자 이력이 없어 undo 를 만들 수 없다. **확정 전에 사실을 말하는 것**이
    유일한 방어다.
  */
  it('되돌릴 수 없다는 것과 다녀옴 초기화를 함께 말한다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.regenerateDayIrreversible)
    expect(markup).toContain(messages.plan.regenerateDayVisitReset)
  })

  it('두 경고가 확정 버튼보다 앞에 온다', () => {
    const markup = render()

    expect(markup.indexOf(messages.plan.regenerateDayIrreversible)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
    expect(markup.indexOf(messages.plan.regenerateDayVisitReset)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
  })

  it('저장 실패 문구를 낸다', () => {
    expect(render({ error: { message: '사라진 장소가 있어요.', retriable: false } })).toContain(
      '사라진 장소가 있어요.',
    )
  })

  /*
    #451. 액션이라 카드가 아니고 L0 바닥 위에 선다 — 위 구분선을 걷었다. 카드 사이 틈으로
    비치는 바닥이 그 일을 하고, 선을 남기면 비교 카드 테두리와 나란히 두 줄로 읽힌다.
  */
  it('위 구분선을 그리지 않는다 — 바닥이 비교 카드와 가른다', () => {
    // 단어 경계로 본다 — `border-transparent` 같은 다른 유틸리티에 걸리면 오탐이다
    expect(render()).not.toMatch(/\bborder-t\b/)
  })
})

/**
 * 시각 초기화 경고 — 이슈 #623 · 명세 D14-6.
 *
 * 재생성 초안에는 시각 필드가 아예 없어 되붙이면 그 날 시각이 전부 사라진다.
 * **잃을 것이 없는 날에는 경고를 내지 않는다** — D9-2 와 같은 판단이다.
 */
describe('PlanDayRegenerateConfirm — 시각 초기화 경고 (#623)', () => {
  it('시각 있는 항목이 있으면 경고를 낸다', () => {
    expect(render({ hasStartTime: true })).toContain(messages.plan.regenerateDayStartTimeReset)
  })

  it('시각 있는 항목이 없으면 경고를 내지 않는다', () => {
    expect(render({ hasStartTime: false })).not.toContain(messages.plan.regenerateDayStartTimeReset)
  })

  it('시각 경고도 다녀옴 경고와 함께 확정 버튼보다 앞이다', () => {
    const markup = render({ hasStartTime: true })

    expect(markup.indexOf(messages.plan.regenerateDayStartTimeReset)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
  })
})

/**
 * 잃을 것이 없는 경고를 걷는다 — 이슈 #984 · 명세 R5.
 *
 * 시각 경고(#623)가 세운 규칙을 앞의 두 줄에도 적용한다. 빈 날에 "되돌릴 수 없어요" 를
 * 띄우면 화면 위의 `아직 담은 곳이 없어요` 와 서로 다른 말을 하고, 늘 뜨는 경고는 배경음이
 * 되어 정작 잃을 날에 읽히지 않는다 (D9-2 와 같은 판단).
 */
describe('PlanDayRegenerateConfirm — 잃을 것이 있을 때만 경고한다 (#984)', () => {
  const EMPTY_DAY = { hasItems: false, hasVisited: false, hasStartTime: false }

  it('빈 날에는 경고를 하나도 내지 않는다', () => {
    const markup = render(EMPTY_DAY)

    expect(markup).not.toContain(messages.plan.regenerateDayIrreversible)
    expect(markup).not.toContain(messages.plan.regenerateDayVisitReset)
    expect(markup).not.toContain(messages.plan.regenerateDayStartTimeReset)
  })

  it('빈 날에도 확정 버튼은 남는다', () => {
    expect(render(EMPTY_DAY)).toContain(messages.plan.regenerateDayApply)
  })

  /*
    버튼의 위 여백(`mt-2`)은 **경고 묶음과 액션을 가르는 값**이다. 앞에 아무것도 없으면
    스택의 간격 위에 8px 이 더 얹혀 다른 액션 블록(`PlanStatusAction`)과 높이가 어긋난다.
  */
  it('앞에 선 것이 없으면 버튼이 위 여백을 갖지 않는다', () => {
    expect(render(EMPTY_DAY)).not.toMatch(/\bmt-2\b/)
  })

  it('저장 실패만 있어도 버튼이 실패 문구와 떨어진다', () => {
    expect(
      render({ ...EMPTY_DAY, error: { message: '사라진 장소가 있어요.', retriable: true } }),
    ).toMatch(/\bmt-2\b/)
  })

  it('다녀옴 표시가 없는 날은 되돌릴 수 없음만 말한다', () => {
    const markup = render({ hasItems: true, hasVisited: false })

    expect(markup).toContain(messages.plan.regenerateDayIrreversible)
    expect(markup).not.toContain(messages.plan.regenerateDayVisitReset)
    expect(markup).toMatch(/\bmt-2\b/)
  })

  it('항목과 다녀옴 표시가 둘 다 있는 날은 두 경고를 확정 버튼 앞에 낸다', () => {
    const markup = render({ hasItems: true, hasVisited: true })
    const apply = markup.indexOf(messages.plan.regenerateDayApply)

    expect(markup.indexOf(messages.plan.regenerateDayIrreversible)).toBeGreaterThanOrEqual(0)
    expect(markup.indexOf(messages.plan.regenerateDayIrreversible)).toBeLessThan(apply)
    expect(markup.indexOf(messages.plan.regenerateDayVisitReset)).toBeGreaterThanOrEqual(0)
    expect(markup.indexOf(messages.plan.regenerateDayVisitReset)).toBeLessThan(apply)
  })
})
