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

  it('상세로 가는 길이 사라지지 않는다 — 제목 대신 액션 열 링크다', () => {
    expect(render()).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('선택 버튼 안에 대화형 요소가 없다 — button 안의 a 는 명세 위반이다', () => {
    const markup = render()
    const selectButton = markup.slice(markup.indexOf('<button'), markup.indexOf('</button>'))

    expect(selectButton).not.toContain('<a ')
    expect(selectButton).not.toContain('href=')
  })

  it('상세 링크가 어느 장소인지 말한다', () => {
    expect(render()).toContain(
      `aria-label="${messages.map.rowDetailLabel.replace('{title}', placeSummary.title)}"`,
    )
  })

  it('renderRowAction 을 액션 열에 그린다 — 담기 버튼이 여기 온다', () => {
    const markup = render({
      renderRowAction: () => createElement('button', { type: 'button' }, '담기'),
    })

    expect(markup).toContain('담기')
    expect(markup).toContain('w-24')
  })

  it('액션이 없어도 열 자체는 있다 — /places 는 상세 링크만 든다', () => {
    expect(render()).toContain('w-24')
  })

  it('renderRowNotice 는 행 아래 전폭이다 — 액션 열은 w-24 라 알림이 못 들어간다', () => {
    const markup = render({
      renderRowNotice: () => createElement('p', { role: 'alert' }, '담지 못했어요'),
    })

    expect(markup).toContain('role="alert"')
    // 알림은 액션 열(w-24) 안이 아니라 그 뒤에 온다
    expect(markup.indexOf('role="alert"')).toBeGreaterThan(markup.indexOf('w-24'))
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
