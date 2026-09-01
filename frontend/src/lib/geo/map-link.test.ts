import { describe, expect, it } from 'vitest'

import { directionsUrl } from '@/lib/geo/map-link'

describe('directionsUrl', () => {
  it('위도가 먼저다 — 뒤집으면 기니 만으로 안내한다', () => {
    const url = directionsUrl({ name: '협재해수욕장', lat: 33.3936, lng: 126.2396 })

    expect(url).toContain(',33.3936,126.2396')
  })

  it('이름을 인코딩한다 — 콤마가 링크 구분자와 충돌한다', () => {
    const url = directionsUrl({ name: '가까운약국, 본점', lat: 33.4, lng: 126.5 })

    expect(url).not.toContain('약국, 본점')
    expect(url).toContain('%2C')
  })

  it('좌표가 없으면 null 이다 — 호출부가 버튼을 그리지 않는다', () => {
    expect(directionsUrl({ name: '협재해수욕장', lat: null, lng: 126.2 })).toBeNull()
    expect(directionsUrl({ name: '협재해수욕장', lat: 33.3, lng: null })).toBeNull()
  })

  it('좌표 0 은 미상으로 보고 null 이다', () => {
    expect(directionsUrl({ name: '어딘가', lat: 0, lng: 0 })).toBeNull()
  })

  it('이름이 비어도 링크는 만든다 — 좌표만 있으면 길찾기는 성립한다', () => {
    const url = directionsUrl({ name: '   ', lat: 33.4, lng: 126.5 })

    expect(url).toContain('%EB%AA%A9%EC%A0%81%EC%A7%80')
  })
})
