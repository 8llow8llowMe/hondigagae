import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayDiff, type PlanDayDiffRow } from '@/features/plan/plan-day-diff'
import { messages } from '@/lib/messages'

const CURRENT: PlanDayDiffRow[] = [
  { title: '제주특별자치도립김창열미술관', caption: '제주시 한림읍 · 실내' },
  { title: '동문재래시장', caption: '제주시 · 야외' },
]

const NEXT: PlanDayDiffRow[] = [
  { title: '오설록 티뮤지엄 카페', caption: '서귀포시 안덕면 · 실내' },
  { title: '사려니숲길 산책', caption: null },
]

function render(overrides: Partial<Parameters<typeof PlanDayDiff>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayDiff, { current: CURRENT, next: NEXT, ...overrides }),
  )
}

describe('PlanDayDiff', () => {
  it('양쪽 제목을 모두 낸다', () => {
    const markup = render()

    expect(markup).toContain('제주특별자치도립김창열미술관')
    expect(markup).toContain('오설록 티뮤지엄 카페')
  })

  it('두 열의 이름을 낸다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.regenerateDayCurrent)
    expect(markup).toContain(messages.plan.regenerateDayNext)
  })

  it('caption 이 null 이면 그 줄만 빠지고 제목은 남는다', () => {
    expect(render()).toContain('사려니숲길 산책')
  })

  /*
    R5. 항목이 0개인 날에도 진입점이 있으므로 "지금" 이 비는 경우가 실제로 생긴다.
    비었다고 말하고 넘어간다 — 그 상태가 사실이다.
  */
  it('지금이 비면 빈 안내를 낸다', () => {
    const markup = render({ current: [] })

    expect(markup).toContain(messages.plan.regenerateDayEmpty)
    expect(markup).toContain('오설록 티뮤지엄 카페')
  })

  it('순서를 1부터 매겨 보여 준다', () => {
    const markup = render()

    expect(markup).toContain('>1<')
    expect(markup).toContain('>2<')
  })

  /*
    껍데기의 `h1` 바로 아래다. `h3` 는 단계를 건너뛰고, 이 화면의 다른 상태(대기·실패·빈
    결과)는 모두 `h2` 를 쓴다.
  */
  it('열 제목이 h2 다 — h1 다음 단계를 건너뛰지 않는다', () => {
    const markup = render()

    expect(markup).toContain('<h2')
    expect(markup).not.toContain('<h3')
  })

  /*
    `<ol>` 안이라 스크린리더가 이미 순번을 읽어 준다 — 숫자를 남기면 두 번 들린다
    (`plan-item-row` · `plan-editable-item-row` 와 같은 판단).
  */
  it('순번 배지를 스크린리더에서 감춘다', () => {
    expect(render()).toContain('<span aria-hidden="true"')
  })
})

/*
  #451. 두 열은 카드 판정 3문을 셋 다 통과한다 — 자기 제목이 있고, 혼자 떼어놔도 말이 되고,
  항목이 여럿이다. 수제 박스(`rounded-md border p-4`)를 `Surface` 로 바꿨다.
*/
describe('PlanDayDiff — 3층 표면 (#451)', () => {
  it('두 열이 L1 카드다 — 수제 박스의 radius 8 을 쓰지 않는다', () => {
    const markup = render()

    expect(markup.match(/<section/g)).toHaveLength(2)
    expect(markup).not.toContain('rounded-md')
    expect(markup).toContain('md:rounded-lg')
  })

  /*
    순서가 뜻을 갖는 목록이라 `ol` 이고 `ul` 인 `SurfaceList` 를 쓸 수 없다 — 같은 구분선
    규약(항목 **사이에만**)을 여기에 건다 (#447 `plan-day-editor` 와 같다).
  */
  it('행 구분선을 항목 사이에만 긋는다', () => {
    expect(render()).toContain('[&amp;&gt;li+li]:border-t')
  })
})
