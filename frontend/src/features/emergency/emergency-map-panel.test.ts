import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyMapPanel } from '@/features/emergency/emergency-map-panel'
import { messages } from '@/lib/messages'
import { facility, pharmacy } from '@/test/fixtures/emergency'

const target = facility()

function render(overrides: Partial<Parameters<typeof EmergencyMapPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(EmergencyMapPanel, {
      facilities: [target, pharmacy()],
      selectedId: null,
      onSelect: () => undefined,
      showDistance: true,
      ...overrides,
    }),
  )
}

describe('EmergencyMapPanel', () => {
  it('행이 링크가 아니라 버튼이다 — 지도 화면에서 행을 누르는 것은 핀 고르기다', () => {
    const markup = render()

    expect(markup).toContain('<button')
    expect(markup).toContain('aria-pressed="false"')
  })

  it('선택된 행을 aria-pressed 와 배경으로 함께 알린다', () => {
    const markup = render({ selectedId: target.facilityId })

    expect(markup).toContain('aria-pressed="true"')
    // 선택 배경은 --row-selected 다. 판정 색(metric-*)을 쓰지 않는다
    expect(markup).toContain('bg-row-selected')
    expect(markup).not.toContain('metric-')
  })

  it('선택된 행에만 길찾기가 나온다', () => {
    expect(render()).not.toContain(messages.map.directions)
    expect(render({ selectedId: target.facilityId })).toContain(messages.map.directions)
  })

  it('선택 버튼 안에 링크를 넣지 않는다 — <a> 를 <button> 안에 둘 수 없다', () => {
    const markup = render({ selectedId: target.facilityId })
    const open = markup.indexOf('<button')
    const close = markup.indexOf('</button>')
    const inside = markup.slice(open, close)

    expect(open).toBeGreaterThan(-1)
    expect(inside).not.toContain('<a ')
  })

  it('전화는 선택 여부와 무관하게 항상 있다 — 급할 때 읽을 것을 선택 뒤로 숨기지 않는다', () => {
    expect(render()).toContain('href="tel:0640000000"')
  })

  it('좌표가 없는 곳도 목록에는 남기고 이유를 말한다 — 병원을 숨기지 않는다', () => {
    const markup = render({ facilities: [facility({ lat: 0, lng: 0 })] })

    expect(markup).toContain(target.name)
    expect(markup).toContain(messages.map.noCoordinate)
  })

  it('좌표가 있는 곳에는 그 안내를 붙이지 않는다', () => {
    expect(render()).not.toContain(messages.map.noCoordinate)
  })

  it('showDistance 가 false 면 거리를 감춘다', () => {
    expect(render({ showDistance: false })).not.toContain('480m')
  })
})
