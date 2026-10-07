import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceVisitKeyLine } from '@/features/place/place-visit-key-line'
import { messages } from '@/lib/messages'

type Props = Parameters<typeof PlaceVisitKeyLine>[0]

const base: Props = {
  name: '수월봉',
  open24: false,
  openNow: null,
  useTime: '상시 개방',
  tel: '064-710-6043',
  lat: 33.2959,
  lng: 126.1625,
}

function render(over: Partial<Props> = {}) {
  return renderToStaticMarkup(createElement(PlaceVisitKeyLine, { ...base, ...over }))
}

describe('PlaceVisitKeyLine — 운영 · 전화 · 길찾기 한 줄', () => {
  it('판정이 없으면 운영시간 원문을 쓴다 (dev 수월봉: openNow null · `상시 개방`)', () => {
    const html = render()

    expect(html).toContain('상시 개방')
    expect(html).not.toContain(messages.place.detailOpenNow)
    expect(html).toContain('tel:0647106043')
    expect(html).toContain('map.kakao.com/link/to/')
  })

  it('판정이 있으면 배지 + 원문 첫 줄', () => {
    const html = render({ openNow: true, useTime: '09:00~17:00<br>(입장 마감 16:30)' })

    expect(html).toContain(messages.place.detailOpenNow)
    expect(html).toContain('09:00~17:00')
    expect(html).not.toContain('입장 마감')
  })

  it('`false` 는 `영업 시간 아님` 이다 (#1160)', () => {
    expect(render({ openNow: false })).toContain(messages.place.detailOpenClosed)
  })

  it('24시간이면 openNow 와 원문을 말하지 않는다', () => {
    const html = render({ open24: true, openNow: false, useTime: '10:00~24:00' })

    expect(html).toContain(messages.place.detailOpen24)
    expect(html).not.toContain(messages.place.detailOpenClosed)
    expect(html).not.toContain('10:00~24:00')
  })

  it('값이 없는 칸은 빠진다 — 좌표가 없으면 길찾기도 없다', () => {
    const html = render({ tel: null, lat: null, lng: null })

    expect(html).toContain('상시 개방')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain(messages.map.directions)
  })

  it('원문이 없으면 판정도 없다 — 운영시간 행과 같은 규칙 (D5-5)', () => {
    const html = render({ useTime: null, openNow: true })

    expect(html).not.toContain(messages.place.detailOpenNow)
    expect(html).toContain('tel:')
  })

  it('셋 다 없으면 줄이 서지 않는다', () => {
    expect(render({ useTime: null, tel: null, lat: null, lng: null })).toBe('')
  })
})
