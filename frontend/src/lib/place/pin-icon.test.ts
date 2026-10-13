import { describe, expect, it } from 'vitest'

import { isCafeLikePlace, isCafePlace } from '@/lib/place/cafe'
import { placePinIcon } from '@/lib/place/pin-icon'

const at = (code: string, sourceCategory: string | null = null) => ({
  contentType: { code },
  sourceCategory,
})

describe('placePinIcon — contentType.code 로 고른다 (#1280 D2-1)', () => {
  it.each([
    ['TOURIST_SPOT', 'landscape'],
    ['RESTAURANT', 'utensils'],
    ['LODGING', 'bed'],
    ['CULTURE', 'museum'],
    ['FESTIVAL', 'flag'],
    ['COURSE', 'footprints'],
    ['LEPORTS', 'bike'],
    ['SHOPPING', 'bag'],
  ] as const)('%s → %s', (code, icon) => {
    expect(placePinIcon(at(code))).toBe(icon)
  })

  it('카페 분류 음식점은 커피잔이다 — 목록 행의 `카페` 와 같은 판정', () => {
    expect(placePinIcon(at('RESTAURANT', '카페'))).toBe('coffee')
    expect(isCafePlace(at('RESTAURANT', '카페'))).toBe(true)
  })

  /*
    이름 판정(`isCafeLikePlace`)은 담기 항목 유형에만 쓴다 (#1472). 핀이 이름으로 커피잔이 되면
    `카페` 칩(서버 조건 `sourceCategory=카페`)으로는 안 나오는 곳이 카페로 보인다.
  */
  it('장소명이 카페여도 원천 분류가 카페가 아니면 핀은 수저다 — 칩과 같은 판정 (#1472)', () => {
    const place = { ...at('RESTAURANT'), title: '카페코지' }

    expect(isCafeLikePlace(place)).toBe(true)
    expect(isCafePlace(place)).toBe(false)
    expect(placePinIcon(place)).toBe('utensils')
  })

  it('음식점이 아니면 원천 분류가 카페여도 바꾸지 않는다', () => {
    expect(placePinIcon(at('TOURIST_SPOT', '카페'))).toBe('landscape')
    expect(isCafePlace(at('TOURIST_SPOT', '카페'))).toBe(false)
  })

  it('모르는 코드는 범용 핀이다 — 분류를 지어내지 않는다', () => {
    expect(placePinIcon(at('UNKNOWN_NEW_TYPE'))).toBe('pin')
  })

  /* 평범한 객체 조회는 프로토타입 키(`constructor` 등)에서 `?? 'pin'` 을 지나친다 */
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    '프로토타입 키 %s 도 범용 핀이다',
    (code) => {
      expect(placePinIcon(at(code))).toBe('pin')
    },
  )
})
