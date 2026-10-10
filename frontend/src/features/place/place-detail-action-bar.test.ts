import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceDetailActionBar,
  type PlaceDetailActions,
} from '@/features/place/place-detail-action-bar'
import { messages } from '@/lib/messages'

const BASE: PlaceDetailActions = {
  authed: true,
  saved: false,
  savePending: false,
  saveError: null,
  onToggleSave: () => undefined,
  added: false,
  onAddToPlan: () => undefined,
  onLogin: () => undefined,
  delisted: false,
}

function render(overrides: Partial<PlaceDetailActions> = {}) {
  return renderToStaticMarkup(createElement(PlaceDetailActionBar, { ...BASE, ...overrides }))
}

describe('하단 바 — 아트보드가 정한 두 개뿐이다', () => {
  it('전화·길찾기를 넣지 않는다 — 네 개면 담기가 묻힌다 (아트보드 01 주석)', () => {
    const markup = render()

    expect(markup).not.toContain('길찾기')
    expect(markup).not.toContain('전화')
  })

  it('담기가 주요 액션이다', () => {
    expect(render()).toContain(messages.plan.addToPlanAction)
  })
})

describe('저장 버튼 — 상태를 aria 로 말한다', () => {
  it('아이콘 버튼이라 이름이 aria-label 에 있다', () => {
    expect(render()).toContain(`aria-label="${messages.favorite.save}"`)
  })

  it('저장하면 이름이 뒤집히고 aria-pressed 가 켜진다', () => {
    const markup = render({ saved: true })

    expect(markup).toContain(`aria-label="${messages.favorite.unsave}"`)
    expect(markup).toContain('aria-pressed="true"')
  })

  it('저장 여부를 아이콘 채움으로도 말한다', () => {
    expect(render({ saved: true })).toContain('fill="currentColor"')
    expect(render({ saved: false })).toContain('fill="none"')
  })

  it('저장 중에는 잠근다 — 연타로 저장·해제가 엇갈리면 안 된다', () => {
    expect(render({ savePending: true })).toContain('disabled')
  })

  it('실패는 바 위에 남긴다 — 토스트로 흘리지 않는다', () => {
    const markup = render({ saveError: messages.favorite.errorDescription })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.favorite.errorDescription)
  })
})

describe('담은 뒤 — 라벨이 바뀐다 (아트보드 02-C)', () => {
  it('같은 자리에서 두 번 담지 않도록 문구가 달라진다', () => {
    const markup = render({ added: true })

    expect(markup).toContain(messages.plan.addToPlanAgainAction)
    expect(markup).not.toContain(`>${messages.plan.addToPlanAction}<`)
  })
})

describe('미로그인 — 저장 아이콘 대신 로그인이다 (아트보드 04 ③)', () => {
  it('빈 북마크를 두지 않는다 — 저장 여부를 알 수 없다', () => {
    const markup = render({ authed: false })

    expect(markup).not.toContain(`aria-label="${messages.favorite.save}"`)
    expect(markup).toContain(messages.plan.addToPlanLoginAction)
  })

  it('담기는 그대로 열려 있다 — 눌러야 로그인 안내가 뜬다', () => {
    expect(render({ authed: false })).toContain(messages.plan.addToPlanAction)
  })
})

describe('원천에서 사라진 장소 — 잠그되 해제는 남긴다 (#146)', () => {
  /** `renderToStaticMarkup` 은 `disabled` 를 `disabled=""` 로 낸다 — 개수로 어느 버튼인지 가른다 */
  function disabledCount(markup: string): number {
    return markup.split('disabled=""').length - 1
  }

  it('왜 잠겼는지 버튼 위에 적는다 — disabled 만으로는 이유를 알 수 없다', () => {
    expect(render({ delisted: true })).toContain(messages.place.detailDelistedActionsBlocked)
  })

  it('평소에는 그 문구가 없다', () => {
    expect(render()).not.toContain(messages.place.detailDelistedActionsBlocked)
  })

  it('미저장이면 담기와 저장을 둘 다 잠근다 — 서버가 PLAN_004 · FAVORITE_001 로 막는다', () => {
    expect(disabledCount(render({ delisted: true, saved: false }))).toBe(2)
  })

  it('이미 저장했으면 해제는 살려 둔다 — DELETE 는 장소 가시성을 보지 않는다', () => {
    const markup = render({ delisted: true, saved: true })

    // 잠기는 것은 담기 하나뿐이다
    expect(disabledCount(markup)).toBe(1)
    expect(markup).toContain(`aria-label="${messages.favorite.unsave}"`)
  })

  it('평소에는 아무것도 잠기지 않는다', () => {
    expect(disabledCount(render())).toBe(0)
  })
})
