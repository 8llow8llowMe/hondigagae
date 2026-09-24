import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ErrorState, ErrorStateView } from '@/components/error-state'
import { messages } from '@/lib/messages'

/**
 * `ErrorState` 의 오프라인 갈래 — 이슈 #912.
 *
 * 훅(`useOnline`)은 node 에서 서버 스냅샷(온라인)으로만 렌더되므로 두 갈래는
 * `ErrorStateView` 에 `offline` 을 직접 넘겨 잰다.
 */
const BASE = {
  title: '장소를 불러오지 못했어요',
  description: messages.common.temporaryErrorDescription,
  onRetry: () => undefined,
}

function view(offline: boolean, extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(ErrorStateView, { ...BASE, ...extra, offline }))
}

describe('ErrorState — 오프라인 (#912)', () => {
  it('온라인이면 받은 제목·설명과 다시 시도를 그대로 그린다', () => {
    const markup = view(false)

    expect(markup).toContain(BASE.title)
    expect(markup).toContain(BASE.description)
    expect(markup).toMatch(new RegExp(`<button[^>]*>${messages.common.retry}</button>`))
    expect(markup).not.toContain(messages.common.offlineTitle)
  })

  it('오프라인이면 원인을 연결로 바꿔 말하고 다시 시도를 걷는다 — 끊긴 채 누르면 같은 실패다', () => {
    const markup = view(true)

    expect(markup).toContain(`>${messages.common.offlineTitle}</h2>`)
    expect(markup).toContain(messages.common.offlineDescription)
    expect(markup).not.toContain(BASE.title)
    expect(markup).not.toContain(BASE.description)
    expect(markup).not.toContain('<button')
  })

  it('오프라인이어도 제목 레벨은 호출부가 정한 대로다', () => {
    expect(view(true, { headingLevel: 3 })).toContain(`>${messages.common.offlineTitle}</h3>`)
  })

  it('오프라인이어도 action(셸 없는 경계의 홈으로)은 남는다', () => {
    const action = createElement('a', { href: '/' }, messages.common.notFoundHomeAction)
    const markup = view(true, { action })

    expect(markup).toContain(`>${messages.common.notFoundHomeAction}</a>`)
    expect(markup).not.toContain('<button')
  })

  it('훅을 거친 ErrorState 는 서버 렌더에서 온라인 갈래다 — 기존 호출부의 마크업이 그대로다', () => {
    const markup = renderToStaticMarkup(createElement(ErrorState, BASE))

    expect(markup).toContain(BASE.title)
    expect(markup).toContain(`>${messages.common.retry}</button>`)
  })
})
