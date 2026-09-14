import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyMapPanel } from '@/features/emergency/emergency-map-panel'
import { formatDistance } from '@/lib/format/distance'
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
    /*
      선택 배경은 `--row-selected` 다 — 판정 색을 선택 표시로 쓰지 않는다.

      **`metric-` 전부를 막던 것을 좁혔다** (#598). 상태 배지가 `진료중` 초록으로
      `metric-high` 를 쓰게 됐는데(`OpenStatus` 머리주석), 그것은 선택 표시가 아니라
      행의 내용이다. 이 테스트가 지키는 것은 **선택된 행의 배경**이므로 거기만 본다.
    */
    expect(markup).toContain('bg-row-selected')

    // 행의 `class` 만 본다 — 안쪽 상태 배지가 쓰는 색은 선택 표시가 아니다
    const li = markup.slice(markup.indexOf('<li'), markup.indexOf('>'))
    expect(li).not.toContain('metric-')
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
    const distanceStr = formatDistance(facility().distanceMeters)
    expect(render({ showDistance: false })).not.toContain(distanceStr)
  })

  it('showDistance 가 true 면 거리를 보인다', () => {
    const distanceStr = formatDistance(facility().distanceMeters)
    expect(render({ showDistance: true })).toContain(distanceStr)
  })
})
