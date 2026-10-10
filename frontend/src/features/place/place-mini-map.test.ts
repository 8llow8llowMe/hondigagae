import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMiniMap } from '@/features/place/place-mini-map'
import { messages } from '@/lib/messages'

/**
 * 지도 캔버스 자체는 `dynamic(..., { ssr: false })` 라 서버 렌더에 나오지 않는다 —
 * 여기서 고정하는 것은 **무엇을 그리고 무엇을 그리지 않는가**의 판단이다.
 * SDK 수명주기는 브라우저에서만 의미가 있고 `MapCanvas` 의 몫이다.
 */
function render(overrides: Partial<Parameters<typeof PlaceMiniMap>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlaceMiniMap, {
      placeId: '212481712381923328',
      title: '제주특별자치도립김창열미술관',
      lat: 33.3608276172,
      lng: 126.7818122232,
      ...overrides,
    }),
  )
}

describe('PlaceMiniMap', () => {
  it('좌표가 있으면 카카오맵 길찾기 링크를 함께 그린다', () => {
    const markup = render()

    expect(markup).toContain(messages.map.directions)
    expect(markup).toContain('map.kakao.com/link/to')
    // 링크 규격은 위도가 먼저다 (`lib/geo/map-link.ts`)
    expect(markup).toContain('33.3608276172,126.7818122232')
  })

  it('외부 링크는 새 탭이고 opener 를 넘기지 않는다', () => {
    const markup = render()

    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
  })

  it('좌표가 없으면 아무것도 그리지 않는다 — 주소는 바로 위에 이미 있다', () => {
    expect(render({ lat: null, lng: null })).toBe('')
  })

  it('0 좌표도 미상으로 본다 — 그리면 기니 만으로 튄다 (`toLatLng`)', () => {
    expect(render({ lat: 0, lng: 0 })).toBe('')
  })

  /*
    **SDK 실패와 좌표 없음을 같이 묶지 않는다.** 처음엔 둘 다 `return null` 로 접었는데,
    지도 스크립트가 안 뜨는 화면에서 **갈 수 있는 유일한 길**인 길찾기까지 함께 사라졌다
    (390 실측: 카카오 스크립트 미로딩 상태에서 기본 정보가 `주소 · 분류` 두 줄만 남았다).

    딥링크는 좌표 하나로 만드는 문자열이라 SDK 와 무관하다. 서버 렌더에서는 캔버스가
    `dynamic(ssr:false)` 로 어차피 비어 있어, 링크가 남는다는 사실을 여기서 고정한다.
  */
  it('지도 캔버스가 없어도 길찾기는 남는다', () => {
    expect(render()).toContain(messages.map.directions)
  })
})
