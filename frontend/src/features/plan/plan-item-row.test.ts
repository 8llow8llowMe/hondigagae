import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanItemRow, type PlanItemVisit } from '@/features/plan/plan-item-row'
import { messages } from '@/lib/messages'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import { planDetail, planItemPlace } from '@/test/fixtures/plan'
import type { PlanItemPlace } from '@/types/plan'

/**
 * 일정 항목 행의 메타 줄 — 이슈 #112.
 *
 * 거리 줄은 `plan-detail.test.ts` 가 값으로 검증한다. 여기서 보는 것은 **항목이 들고 온
 * `place` 요약이 메타 줄로 옮겨지는 방식**이다 (#86·#115) — 특히 `indoor` 가 `null` 일 때
 * "야외" 로 단정하지 않는지.
 */
function render(place: PlanItemPlace | null) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, place },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(createElement(PlanItemRow, { model }))
}

describe('PlanItemRow — 메타 줄 (#112)', () => {
  it('주소와 실내 여부를 한 줄로 붙인다 (명세 D2)', () => {
    expect(render(planItemPlace())).toContain(`제주시 한림읍 · ${messages.place.rowIndoor}`)
  })

  it('야외면 야외라고 쓴다', () => {
    expect(render(planItemPlace({ indoor: false }))).toContain(
      `제주시 한림읍 · ${messages.place.rowOutdoor}`,
    )
  })

  it('실내 여부를 모르면 낱말만 빠지고 주소는 남는다 — 야외라고 단정하지 않는다', () => {
    const markup = render(planItemPlace({ indoor: null }))

    expect(markup).toContain('제주시 한림읍')
    expect(markup).not.toContain(messages.place.rowOutdoor)
  })

  it('실내 여부만 있고 주소가 없으면 낱말만 남는다 — 빈 구분자를 남기지 않는다', () => {
    const markup = render(planItemPlace({ addr1: null }))

    expect(markup).toContain(messages.place.rowIndoor)
    expect(markup).not.toContain(`· ${messages.place.rowIndoor}`)
  })

  it('place 가 통째로 비어도 행을 지우지 않는다 — 일정 자료는 우리 DB 고 장소는 다른 서비스다', () => {
    const markup = render(null)

    expect(markup).toContain(planDetail.items[0]!.title)
  })

  it('미확인 배지를 만들지 않는다 — 여기에는 실내 필터가 없어 설명할 자리가 없다', () => {
    const markup = render(planItemPlace({ indoor: null }))

    expect(markup).not.toContain(messages.place.rowIndoorUnknown)
  })
})

/**
 * 방문 체크 토글 — 이슈 #124.
 *
 * `visit` 를 넘기지 않으면 토글이 아예 없다는 것까지 본다. 기간 밖 고아 항목 섹션이
 * 그 경로다 — 어느 일자에도 속하지 않는 항목에 '다녀옴' 을 두면 무엇을 다녀왔다는
 * 것인지 말할 수 없다.
 */
function renderWithVisit({ visited = false, visit }: { visited?: boolean; visit?: PlanItemVisit }) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, visited },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(
    createElement(PlanItemRow, visit === undefined ? { model } : { model, visit }),
  )
}

const idleVisit: PlanItemVisit = { pending: false, error: null, onToggle: () => undefined }

describe('PlanItemRow — 방문 체크 토글 (#124)', () => {
  it('visit 를 넘기지 않으면 토글이 없다 — 기간 밖 항목 섹션의 경로다', () => {
    const markup = renderWithVisit({})

    expect(markup).not.toContain(messages.plan.visitAction)
    expect(markup).not.toContain('aria-pressed')
  })

  it('체크되지 않은 항목은 aria-pressed=false 이고 이름이 "표시" 다', () => {
    const markup = renderWithVisit({ visited: false, visit: idleVisit })

    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain(`aria-label="${messages.plan.visitAction}"`)
  })

  /*
    **WCAG 2.5.3 Label in Name** (#653). 토글이 `iconOnly` 를 벗으면서 보이는 글자가
    생겼다 — 접근 가능한 이름이 그 글자를 **포함하지 않으면** 음성 제어 사용자가 화면에
    보이는 그대로 말했을 때 버튼이 잡히지 않는다. 아이콘만이던 시절에는 없던 제약이라
    글자를 붙이면서 새로 생겼고, 이 단언이 그 관계를 잠근다.
  */
  it('보이는 글자가 접근 가능한 이름에 들어 있다 — 양쪽 상태 모두', () => {
    expect(messages.plan.visitAction).toContain(messages.plan.visitToggleLabel)
    expect(messages.plan.visitedAction).toContain(messages.plan.visitedLabel)
  })

  it('체크된 항목은 aria-pressed=true 이고 이름이 "해제" 다 — 누르면 일어날 일을 말한다', () => {
    const markup = renderWithVisit({ visited: true, visit: idleVisit })

    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain(`aria-label="${messages.plan.visitedAction}"`)
  })

  /*
    낱말로도 말한다는 요구는 그대로이고(#124), **그 일을 하는 요소가 배지에서 토글 버튼으로
    옮겨 갔다** (#653 · 진단 PL-5 · 명세 D11-5). 버튼이 `iconOnly` 를 벗으면서 같은 낱말이
    한 행에 두 번 서서 배지를 걷었다.

    **`aria-label` 에 걸리지 않게 닫는 태그까지 묶어 본다.** `다녀옴` 은 토글 이름
    (`다녀옴으로 표시`)의 substring 이라 낱낱으로 찾으면 꺼진 행에서도 걸린다.
  */
  it('체크된 항목은 낱말로도 말한다 — 색·투명도만으로 전달하지 않는다', () => {
    const visited = `${messages.plan.visitedLabel}</button>`

    expect(renderWithVisit({ visited: true, visit: idleVisit })).toContain(visited)
    expect(renderWithVisit({ visited: false, visit: idleVisit })).not.toContain(visited)
  })

  /*
    **체크 전에 `다녀옴` 이라고 적지 않는다.** 아직 안 간 행에 그 낱말이 있으면 훑는
    사람에게 그 행이 이미 다녀온 것으로 읽힌다 — 모르는 것보다 틀리게 아는 것이 나쁘다.
  */
  it('체크 전에는 상태가 아니라 할 일을 적는다', () => {
    const markup = renderWithVisit({ visited: false, visit: idleVisit })

    expect(markup).toContain(`${messages.plan.visitToggleLabel}</button>`)
    expect(markup).not.toContain(`>${messages.plan.visitedLabel}</button>`)
  })

  /* 같은 사실을 배지와 버튼이 두 번 말하지 않는다 — 배지를 걷은 근거 */
  it('체크된 행에서 다녀옴이 한 번만 보인다', () => {
    const markup = renderWithVisit({ visited: true, visit: idleVisit })
    const visible = markup.match(new RegExp(`>${messages.plan.visitedLabel}<`, 'g')) ?? []

    expect(visible).toHaveLength(1)
  })

  it('저장 중이면 그 행의 토글만 잠기고 aria-busy 가 붙는다', () => {
    const markup = renderWithVisit({ visit: { ...idleVisit, pending: true } })

    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('disabled')
  })

  it('실패는 토스트가 아니라 이 행에 남는다 — role=alert 로 알린다', () => {
    const markup = renderWithVisit({
      visit: {
        ...idleVisit,
        error: { message: messages.plan.visitErrorDescription, retriable: true },
      },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.visitErrorDescription)
  })

  /*
    **문구로 세지 않는다.** 실패 문장 자체가 "다시 시도해 주세요" 를 품고 있어
    `messages.common.retry` 를 substring 으로 찾으면 항상 걸린다. 버튼 개수로 본다 —
    행에 있는 버튼은 토글 하나뿐이어야 한다.
  */
  function buttonCount(markup: string): number {
    return markup.split('<button').length - 1
  }

  it('실패해도 재시도 버튼을 따로 두지 않는다 — 같은 토글을 다시 누르는 것이 재시도다', () => {
    const markup = renderWithVisit({
      visit: {
        ...idleVisit,
        error: { message: messages.plan.visitErrorDescription, retriable: true },
      },
    })

    expect(buttonCount(markup)).toBe(1)
  })

  it('4xx 는 새로고침을 안내하고, 그때도 버튼이 늘지 않는다', () => {
    const markup = renderWithVisit({
      visit: { ...idleVisit, error: { message: messages.plan.visitStaleError, retriable: false } },
    })

    expect(markup).toContain(messages.plan.visitStaleError)
    expect(buttonCount(markup)).toBe(1)
  })
})

/**
 * 항목 시작 시각 — 이슈 #623 · 명세 D14-2 · D14-3 · D14-7.
 *
 * **D8-9 를 뒤집는다.** 아트보드 헤더 주석 "시간 없음" 은 예시 일정에 값이 없었다는
 * 사실이지 표시 금지가 아니다 — 이탈 근거는 `plan-item-row.tsx` 문서 주석에 있다.
 */
function renderWithStartTime(startTime: string | null) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, startTime },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(createElement(PlanItemRow, { model }))
}

describe('PlanItemRow — 시작 시각 (#623)', () => {
  it('시각이 있으면 정규화된 HH:mm 을 <time> 으로 그린다', () => {
    const markup = renderWithStartTime('10:30:00')

    // React 서버 렌더 출력은 `dateTime` (camelCase) 그대로다 — 실제 DOM에서는
    // 브라우저가 `datetime` 으로 정규화한다
    expect(markup).toContain('<time dateTime="10:30"')
    expect(markup).toContain(messages.plan.startTimeSrLabel)
  })

  it('null 이면 시각 줄이 없다 — 지어내지 않는다', () => {
    const markup = renderWithStartTime(null)

    expect(markup).not.toContain('<time')
    expect(markup).not.toContain(messages.plan.startTimeSrLabel)
  })

  it('형식이 어긋난 값도 시각 줄을 그리지 않는다', () => {
    const markup = renderWithStartTime('오전 10시')

    expect(markup).not.toContain('<time')
  })

  it('시각 줄이 제목보다 앞이다 — 제목 위 캡션이다', () => {
    const markup = renderWithStartTime('10:30:00')
    const title = planDetail.items[0]!.title

    expect(markup.indexOf('10:30')).toBeLessThan(markup.indexOf(title))
  })

  it('메타 줄을 밀어내지 않는다 — 주소가 여전히 나온다', () => {
    const model: PlanItemRowModel = {
      item: { ...planDetail.items[0]!, startTime: '10:30:00', place: planItemPlace() },
      distanceMeters: null,
      distanceKind: null,
    }
    const markup = renderToStaticMarkup(createElement(PlanItemRow, { model }))

    expect(markup).toContain('제주시 한림읍')
  })
})
