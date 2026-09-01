import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { FacilitySelectedCard } from '@/features/emergency/facility-selected-card'
import { messages } from '@/lib/messages'
import type { NearbyFacilityItem } from '@/types/emergency'

function facility(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return {
    facilityId: '4611686018427387904',
    facilityType: { code: 'ANIMAL_HOSPITAL', name: '동물병원', description: null },
    name: '제주24시동물병원',
    addr: '제주특별자치도 제주시 연북로 100',
    lat: 33.48,
    lng: 126.49,
    tel: '064-000-0000',
    operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
    restDate: '일요일',
    open24: true,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 480,
    ...overrides,
  }
}

function render(item: NearbyFacilityItem, showDistance = true) {
  return renderToStaticMarkup(
    createElement(FacilitySelectedCard, {
      facility: item,
      showDistance,
      onClose: () => undefined,
    }),
  )
}

describe('FacilitySelectedCard — 액션', () => {
  it('전화는 tel: 링크이고 숫자만 남긴다', () => {
    expect(render(facility())).toContain('href="tel:0640000000"')
  })

  it('길찾기는 외부 지도 앱으로 나간다 — 경로 안내를 우리가 그리지 않는다', () => {
    const markup = render(facility())

    expect(markup).toContain('map.kakao.com/link/to')
    expect(markup).toContain('rel="noopener noreferrer"')
  })

  it('선택 카드에만 길찾기가 있다 — 라벨을 확인한다', () => {
    expect(render(facility())).toContain(messages.map.directions)
  })

  it('좌표가 없으면 길찾기 버튼을 두지 않는다 — 눌러도 못 가는 버튼은 없는 것만 못하다', () => {
    const markup = render(facility({ lat: 0, lng: 0 }))

    expect(markup).not.toContain('map.kakao.com')
    expect(markup).not.toContain(messages.map.directions)
  })

  it('번호가 없으면 전화 대신 이유를 준다', () => {
    const markup = render(facility({ tel: null }))

    expect(markup).not.toContain('href="tel:')
    expect(markup).toContain(messages.emergency.telMissing)
  })
})

describe('FacilitySelectedCard — 표기', () => {
  it('위치 폴백이면 거리를 감춘다 — 제주 중심 기준 거리를 내 위치로 읽는다', () => {
    expect(render(facility(), false)).not.toContain('480m')
  })

  it('진료시간은 서버 문자열 그대로 렌더한다', () => {
    expect(render(facility())).toContain('월~금 09:00~19:00, 토 09:00~13:00')
  })

  it('시간 정보가 없으면 휴무가 아니라 "확인 필요" 로 말한다', () => {
    const markup = render(facility({ operatingHoursKnown: false, operatingHours: null }))

    expect(markup).toContain(messages.emergency.hoursUnknown)
  })

  it('유형 배지는 약국에만 붙는다 — 모든 카드에 붙으면 신호가 죽는다', () => {
    // 이름에 '동물병원' 이 든 기본 fixture 로는 배지 유무를 문자열로 가릴 수 없다
    const hospital = render(facility({ name: '한라메디컬센터' }))
    const pharmacy = render(
      facility({
        name: '한라메디컬센터',
        facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
      }),
    )

    expect(hospital).not.toContain('동물병원')
    expect(pharmacy).toContain('동물약국')
  })
})
