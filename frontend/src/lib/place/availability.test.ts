import { describe, expect, it } from 'vitest'

import { isPlaceUnavailable } from '@/lib/place/availability'

describe('isPlaceUnavailable — delisted 와 병합은 응답 모양이 다르다 (#146)', () => {
  it('delisted 는 200 응답의 플래그로 온다', () => {
    expect(isPlaceUnavailable({ detail: { delisted: true }, errorStatus: null })).toBe(true)
  })

  it('멀쩡한 장소는 담을 수 있다', () => {
    expect(isPlaceUnavailable({ detail: { delisted: false }, errorStatus: null })).toBe(false)
  })

  it('404 는 병합된 장소다 — 본문이 없어도 결론은 같다', () => {
    expect(isPlaceUnavailable({ detail: undefined, errorStatus: 404 })).toBe(true)
  })

  /**
   * 이 케이스가 이슈 #146 그 자체다. 예전 구현은 404 만 봤고, delisted 장소는 200 으로
   * 오므로 **한 번도 걸리지 않았다.**
   */
  it('delisted 인데 200 이면 예전 구현은 놓쳤다 — 이제 잡는다', () => {
    expect(isPlaceUnavailable({ detail: { delisted: true }, errorStatus: null })).toBe(true)
  })

  it('아직 못 받았으면 담을 수 없다고 말하지 않는다 — 번복이 더 자주 보인다', () => {
    expect(isPlaceUnavailable({ detail: undefined, errorStatus: null })).toBe(false)
  })

  it('404 가 아닌 실패는 판정하지 않는다 — 500 은 장소가 사라진 게 아니라 서버가 죽은 것이다', () => {
    expect(isPlaceUnavailable({ detail: undefined, errorStatus: 500 })).toBe(false)
    expect(isPlaceUnavailable({ detail: undefined, errorStatus: 401 })).toBe(false)
  })
})
