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

  /*
    #1300 D1-2 — #1286 D8-3("요약에서 `/emergency` 링크 두지 않음")을 대체한다. 알약에서 `병원 · 약국` 링크가 빠져
    이 링크가 지도에서 `/emergency` 로 가는 길이다. 정규 주소(= 목록 보기)로 보내고 고른 시설은 넘기지 않는다.
  */
  it.each(['panel', 'sheet'] as const)(
    '본문 맨 아래 주변 병원·약국 더 보기 → /emergency 링크 하나다 — %s',
    (variant) => {
      const markup = summary(facility({ tel: null }), variant)
      const links = [...markup.matchAll(/<a [^>]*href="\/emergency[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]

      expect(links).toHaveLength(1)
      expect(links[0]?.[0]).toContain('href="/emergency"')
      expect(links[0]?.[1]).toContain(messages.map.facilityMoreNearby)
      // 화살표는 아이콘(aria-hidden)이다 — `→` 글자는 스크린리더가 읽는다
      expect(links[0]?.[1]).not.toContain('→')
      expect(links[0]?.[1]).toContain('<svg')
      expect(/class="([^"]*)"/.exec(links[0]?.[0] ?? '')?.[1]?.split(/\s+/)).toContain('min-h-11')
      // 전화 없음 안내 다음, 맨 아래다
      expect(markup.indexOf(messages.map.previewCallUnavailable)).toBeLessThan(
        markup.indexOf(messages.map.facilityMoreNearby),
      )
    },
  )
})
