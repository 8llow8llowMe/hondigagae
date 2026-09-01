import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'

const withoutCoord = {
  ...placeSummary,
  placeId: '999',
  title: '좌표 없는 곳',
  lat: null,
  lng: null,
}

function render(overrides: Partial<Parameters<typeof PlaceMapPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlaceMapPanel, {
      places: [placeSummary],
      selectedId: null,
      onSelect: () => undefined,
      ...overrides,
    }),
  )
}

describe('PlaceMapPanel', () => {
  it('행이 링크가 아니라 버튼이다 — 지도 화면에서 행을 누르는 것은 핀 고르기다', () => {
    const markup = render()

    expect(markup).toContain('<button')
    expect(markup).toContain('aria-pressed="false"')
  })

  it('제목은 링크로 남긴다 — 상세로 가는 길이 사라지면 안 된다', () => {
    expect(render()).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('선택된 행을 aria-pressed 와 배경으로 함께 알린다', () => {
    const markup = render({ selectedId: placeSummary.placeId })

    expect(markup).toContain('aria-pressed="true"')
    // 선택 배경은 --row-selected 다. 판정 색(metric-*)을 쓰지 않는다
    expect(markup).toContain('bg-row-selected')
    expect(markup).not.toContain('metric-')
  })

  it('좌표가 없는 곳도 목록에는 남기고 이유를 말한다 — 목록으로도 도달 가능해야 한다', () => {
    const markup = render({ places: [withoutCoord] })

    expect(markup).toContain(withoutCoord.title)
    expect(markup).toContain(messages.map.noCoordinate)
  })

  it('좌표가 있는 곳에는 그 안내를 붙이지 않는다', () => {
    expect(render()).not.toContain(messages.map.noCoordinate)
  })
})
