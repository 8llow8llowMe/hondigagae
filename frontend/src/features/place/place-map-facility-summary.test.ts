import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMapFacilitySummary } from '@/features/place/place-map-facility-summary'
import { messages } from '@/lib/messages'
import { facility, pharmacy } from '@/test/fixtures/emergency'
import type { NearbyFacilityItem } from '@/types/emergency'

/** 시설 요약 — 장소 미리보기 자리 (#1286 D4-3) */
const WED_NOON = new Date(2026, 8, 16, 12)

function summary(item: NearbyFacilityItem, variant: 'panel' | 'sheet' = 'panel') {
  return renderToStaticMarkup(
    createElement(PlaceMapFacilitySummary, {
      facility: item,
      variant,
      onClose: () => undefined,
      now: WED_NOON,
    }),
  )
}

function sectionTag(markup: string): string {
  return /<section[^>]*>/.exec(markup)?.[0] ?? ''
}

describe('PlaceMapFacilitySummary', () => {
  it('요약 section 이 이름을 갖고 포커스를 받을 수 있다', () => {
    const tag = sectionTag(summary(facility()))

    expect(tag).toContain(`aria-label="${messages.map.facilitySummaryLabel}"`)
    expect(tag).toContain('tabindex="-1"')
  })

  it('이름 · 주소 · 전화 · 길찾기를 그린다', () => {
    const item = facility()
    const markup = summary(item)

    expect(markup).toContain(item.name)
    expect(markup).toContain(item.addr)
    expect(markup).toContain(messages.emergency.callLabel.replace('{name}', item.name))
    expect(markup).toContain(`>${messages.map.directions}</a>`)
  })

  /* 조회 중심이 제주시청이라 distanceMeters 는 사용자와 무관하다 (D3-1) */
  it('거리를 쓰지 않는다', () => {
    const markup = summary(facility({ distanceMeters: 480 }))

    expect(markup).not.toContain('480m')
  })

  it('약국은 서버 유형 이름 배지가 선다', () => {
    expect(summary(pharmacy())).toContain('동물약국')
  })

  it('openNow: null 은 닫힘이 아니라 확인 필요다', () => {
    const markup = summary(facility({ openNow: null }))

    expect(markup).toContain(messages.emergency.statusUnknown)
    expect(markup).not.toContain(messages.emergency.statusClosed)
  })

  it('전화번호가 없으면 비활성 칸 아래 이유를 글자로 준다', () => {
    const markup = summary(facility({ tel: null }))

    expect(markup).toContain(messages.map.previewCallUnavailable)
    expect(markup).not.toContain('href="tel:')
  })

  it('전화번호가 있으면 그 캡션이 없다', () => {
    expect(summary(facility())).not.toContain(messages.map.previewCallUnavailable)
  })

  it('닫기 이름은 요약 닫기다 — 장소 미리보기 닫기가 아니다', () => {
    const markup = summary(facility())

    expect(markup).toContain(`aria-label="${messages.map.facilitySummaryClose}"`)
    expect(markup).not.toContain(messages.map.previewClose)
  })

  it('패널은 1024~1279 의 ‹ 목록 을 두고 시트에는 없다', () => {
    expect(summary(facility(), 'panel')).toContain(`${messages.map.previewBackToList}</button>`)
    expect(summary(facility(), 'sheet')).not.toContain(`${messages.map.previewBackToList}</button>`)
  })

  it('/emergency 로 가는 링크가 없다 (D8-3)', () => {
    expect(summary(facility())).not.toContain('href="/emergency')
  })
})
