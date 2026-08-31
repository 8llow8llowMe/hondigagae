import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanItemRow } from '@/features/plan/plan-item-row'
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
