import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanOptionsSection } from '@/features/ai-plan/ai-plan-options-section'
import { MAX_PINNED_PLACES } from '@/lib/ai-plan/pinned'
import { messages } from '@/lib/messages'
import type { PinnedPlace } from '@/types/ai-plan'

type Props = Parameters<typeof AiPlanOptionsSection>[0]

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    preferFavorites: false,
    favoriteCount: 12,
    pinnedPlaces: [],
    onPreferFavoritesChange: () => undefined,
    onRemovePinned: () => undefined,
    onOpenPicker: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanOptionsSection, props))
}

function place(placeId: string, title: string): PinnedPlace {
  return { placeId, title }
}

describe('AiPlanOptionsSection — "먼저" 와 "꼭" 을 갈라 쓴다 (아트보드 05)', () => {
  /*
    `preferFavorites` 는 우선순위(조건이 맞을 때만)이고 `pinnedPlaceIds` 는 배치 보장이다.
    아트보드가 두 문구를 섞지 말라고 못박았다 — 지키지 못할 약속을 하면 결과를 못 믿게 된다.
  */
  it('저장한 곳은 "먼저" 라고 말한다 — "반드시" 라고 하지 않는다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.preferFavoritesLabel)
    expect(messages.aiPlan.preferFavoritesLabel).toContain('먼저')
    expect(messages.aiPlan.preferFavoritesLabel).not.toContain('반드시')
  })

  it('꼭 넣을 장소는 "반드시" 라고 말한다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.pinnedHint)
    expect(messages.aiPlan.pinnedHint).toContain('반드시')
  })
})

describe('AiPlanOptionsSection — 저장한 곳 먼저', () => {
  it('개수를 말한다 — 무엇이 후보에 들어가는지 알아야 한다', () => {
    expect(render({ favoriteCount: 12 })).toContain('저장한 12곳을')
  })

  it('저장한 장소 보기 링크를 준다', () => {
    const html = render({ favoriteCount: 12 })

    expect(html).toContain(messages.aiPlan.preferFavoritesLink)
    expect(html).toContain('href="/favorites"')
  })

  it('0곳이면 비활성하되 **숨기지 않는다** — 이유와 해결 방법을 함께 낸다', () => {
    const html = render({ favoriteCount: 0 })

    expect(html).toContain(messages.aiPlan.preferFavoritesLabel)
    expect(html).toContain('disabled')
    expect(html).toContain(messages.aiPlan.preferFavoritesEmpty)
    expect(html).toContain('href="/places"')
  })

  it('0곳이면 켜진 상태로 그리지 않는다 — 켤 수 없는 옵션이 켜져 보이면 안 된다', () => {
    const html = render({ favoriteCount: 0, preferFavorites: true })

    expect(html).not.toContain('checked=""')
  })

  it('개수를 아직 모르면(null) 비활성하지 않는다 — 조회가 느린 사용자가 못 켜게 된다', () => {
    const html = render({ favoriteCount: null })

    expect(html).not.toContain('disabled')
    expect(html).not.toContain(messages.aiPlan.preferFavoritesEmpty)
  })

  it('개수를 모르면 힌트를 숨긴다 — "저장한 0곳" 이 스쳤다 바뀌면 잘못된 사실을 먼저 보인다', () => {
    expect(render({ favoriteCount: null })).not.toContain('저장한 0곳을')
  })
})

describe('AiPlanOptionsSection — 꼭 넣을 장소', () => {
  it('상한을 상시 노출한다 — 10곳에 닿아서야 알게 하지 않는다', () => {
    expect(render({ pinnedPlaces: [] })).toContain(`0 / ${MAX_PINNED_PLACES}`)
  })

  it('고른 개수를 카운터에 반영한다', () => {
    const html = render({ pinnedPlaces: [place('1', '협재해수욕장'), place('2', '쇠소깍')] })

    expect(html).toContain(`2 / ${MAX_PINNED_PLACES}`)
  })

  it('고른 곳을 칩으로 그린다', () => {
    const html = render({ pinnedPlaces: [place('1', '협재해수욕장')] })

    expect(html).toContain('협재해수욕장')
  })

  it('제거 버튼 이름에 장소명이 들어간다 — 칩만으로는 어느 것을 빼는지 모른다', () => {
    const html = render({ pinnedPlaces: [place('1', '협재해수욕장')] })

    expect(html).toContain('aria-label="협재해수욕장 빼기"')
  })

  it('고른 곳이 없어도 고르기 버튼은 있다', () => {
    expect(render({ pinnedPlaces: [] })).toContain(messages.aiPlan.pinnedAdd)
  })
})

describe('AiPlanOptionsSection — 미구현 범위가 새지 않는다 (회귀 감시)', () => {
  /*
    다중 반려견(`petIds`)은 아트보드 05 에 설계돼 있으나 `plan-service` 의 `Plan` 이
    `petId` 단일이라 미뤘다 (명세 S8). 이 섹션에 반려견 컨트롤이 들어오면 그 판단이
    조용히 깨진 것이다.
  */
  it('반려견 선택 컨트롤을 두지 않는다', () => {
    const html = render()

    expect(html).not.toContain('petId')
    expect(html).not.toContain('함께 가는 아이')
  })
})
