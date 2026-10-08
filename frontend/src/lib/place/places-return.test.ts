import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PLACES_PATH,
  readPlacesHref,
  rememberPlacesHref,
  safePlacesHref,
} from '@/lib/place/places-return'

/*
  #1272 — 목록 보기에서 상세로 들어갔다가 `장소 찾기` 를 누르면 지도로 갔다. 링크가 `/places` 로
  고정인데 기본 보기가 지도라서다. 떠난 주소(보기 · 필터)를 탭 단위로 기억했다가 돌아간다.
*/
describe('safePlacesHref — 꺼낸 값은 신뢰 경계 밖이다', () => {
  it('장소 찾기 주소는 쿼리째 그대로다', () => {
    expect(safePlacesHref('/places')).toBe('/places')
    expect(safePlacesHref('/places?view=list')).toBe('/places?view=list')
    expect(safePlacesHref('/places?view=list&type=CAFE&keyword=%EC%B9%B4')).toBe(
      '/places?view=list&type=CAFE&keyword=%EC%B9%B4',
    )
  })

  it('없거나 장소 찾기가 아니면 /places 로 떨어진다', () => {
    for (const raw of [
      null,
      '',
      '/places/123',
      '/placesx',
      '/',
      '//evil.com/places',
      'https://evil.com/places',
      '/places\n',
    ]) {
      expect(safePlacesHref(raw)).toBe(PLACES_PATH)
    }
  })
})

describe('rememberPlacesHref · readPlacesHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('기억한 주소를 그대로 돌려준다', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })

    rememberPlacesHref('/places?view=list')

    expect(readPlacesHref()).toBe('/places?view=list')
  })

  it('저장소가 없으면(SSR) /places 다', () => {
    expect(readPlacesHref()).toBe(PLACES_PATH)
  })

  it('저장소 접근이 던져도(사이트 데이터 차단) /places 로 조용히 떨어진다', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    })

    expect(() => rememberPlacesHref('/places?view=list')).not.toThrow()
    expect(readPlacesHref()).toBe(PLACES_PATH)
  })
})
