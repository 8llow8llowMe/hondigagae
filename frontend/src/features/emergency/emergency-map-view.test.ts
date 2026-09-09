import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PositionNotice, visibleCountLabel } from '@/features/emergency/emergency-map-view'
import type { PositionFailure } from '@/lib/geo/current-position'
import { messages } from '@/lib/messages'

describe('visibleCountLabel', () => {
  it('선택되지 않았을 때는 messages.map.visibleCount 를 쓴다 — "지도에 보이는" 이 참인 상태다', () => {
    expect(visibleCountLabel(12, false)).toBe(messages.map.visibleCount.replace('{n}', '12'))
  })

  it('선택 중일 때는 messages.emergency.selectedCount 를 쓴다 — 지도 프레임과 목록이 어긋난 뒤라 "보이는" 이라고 말하지 않는다', () => {
    expect(visibleCountLabel(12, true)).toBe(messages.emergency.selectedCount.replace('{n}', '12'))
  })

  it('개수 자체는 선택 여부와 무관하게 그대로 진실이다', () => {
    const unselected = visibleCountLabel(4, false)
    const selected = visibleCountLabel(4, true)

    expect(unselected).toContain('4')
    expect(selected).toContain('4')
    // 문구가 다르다는 것도 함께 고정한다 — 같으면 B1 회귀다
    expect(unselected).not.toBe(selected)
  })
})

function renderNotice(reason: PositionFailure, onRetry: () => void = () => undefined) {
  return renderToStaticMarkup(createElement(PositionNotice, { reason, onRetry }))
}

describe('PositionNotice', () => {
  it('denied — 안내와 다시 시도 링크를 함께 그린다', () => {
    const markup = renderNotice('denied')

    expect(markup).toContain(messages.emergency.positionDenied)
    expect(markup).toContain(messages.emergency.retryPosition)
  })

  it('timeout — 안내와 다시 시도 링크를 함께 그린다', () => {
    const markup = renderNotice('timeout')

    expect(markup).toContain(messages.emergency.positionTimeout)
    expect(markup).toContain(messages.emergency.retryPosition)
  })

  it('unsupported — 다시 시도해도 같은 답이라 링크를 아예 두지 않는다', () => {
    const markup = renderNotice('unsupported')

    expect(markup).toContain(messages.emergency.positionUnsupported)
    expect(markup).not.toContain(messages.emergency.retryPosition)
  })

  it('outside — 권한 문제로 읽히지 않고, 다시 시도 링크도 없다', () => {
    const markup = renderNotice('outside')

    expect(markup).toContain(messages.emergency.positionOutside)
    expect(markup).not.toContain(messages.emergency.retryPosition)
    // "권한" 이라는 단어로 읽히면 안 된다 — outside 는 위치를 이미 정확히 받은 상태다
    expect(markup).not.toContain('권한')
  })

  it('다시 시도는 버튼이다 — 이동이 아니라 같은 화면에서 다시 요청하는 액션이다', () => {
    const markup = renderNotice('denied')
    const buttonOpen = markup.indexOf('<button')
    const buttonClose = markup.indexOf('</button>')

    expect(buttonOpen).toBeGreaterThan(-1)
    // <a> 로 감싸지 않는다 — 페이지 이동이 아니다
    expect(markup.slice(buttonOpen, buttonClose)).not.toContain('<a ')
  })

  it('다시 시도 링크가 44px 터치 영역(h-11)을 유지한다 — 글자 크기로 때우지 않는다', () => {
    const markup = renderNotice('denied')
    const buttonOpen = markup.indexOf('<button')
    const buttonClose = markup.indexOf('</button>')
    const button = markup.slice(buttonOpen, buttonClose)

    expect(button).toContain('h-11')
  })

  it('한 줄 레이아웃이다 — 이전처럼 세로로 쌓인 블록(flex-col)이 아니라 한 행(items-center)이다', () => {
    const markup = renderNotice('denied')

    expect(markup).toContain('items-center')
    expect(markup).not.toContain('flex-col')
  })
})
