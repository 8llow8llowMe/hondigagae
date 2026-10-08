import { describe, expect, it } from 'vitest'

import { fallbackListHref, mapFailureMessage } from '@/lib/map/failure-fallback'
import { messages } from '@/lib/messages'

/*
  #1289 — 지도 SDK 가 실패하면 안내 화면(축소판 목록) 대신 그 화면의 목록 보기로 보낸다. 왜 목록인지는
  토스트 한 번이 말한다.
*/
describe('mapFailureMessage — 실패 사유별 토스트 문구 (#1289)', () => {
  it('사유마다 다른 문구다 — 설정 문제와 네트워크 문제는 할 말이 다르다', () => {
    expect(mapFailureMessage('no-key')).toBe(messages.map.errorNoKey)
    expect(mapFailureMessage('script')).toBe(messages.map.errorScript)
    expect(mapFailureMessage('unsupported')).toBe(messages.map.errorUnsupported)
  })

  it('목록으로 옮긴 뒤에 뜨는 말이라 이미 일어난 일로 말한다', () => {
    for (const reason of ['no-key', 'script', 'unsupported'] as const) {
      expect(mapFailureMessage(reason)).toMatch(/목록으로 보여드려요\.$/)
    }
  })
})

describe('fallbackListHref — 목록 주소에서 미리보기만 뺀다 (#1289)', () => {
  it('미리보기(?place=)는 목록에 없으니 뺀다', () => {
    expect(fallbackListHref('/places?view=list&place=126451')).toBe('/places?view=list')
  })

  it('필터 · 검색어는 그대로 남긴다', () => {
    expect(fallbackListHref('/places?view=list&contentType=CAFE&keyword=%EC%B9%B4')).toBe(
      '/places?view=list&contentType=CAFE&keyword=%EC%B9%B4',
    )
  })

  it('해시를 보존한다', () => {
    expect(fallbackListHref('/plans/1/days/2/add?view=list&place=9#list')).toBe(
      '/plans/1/days/2/add?view=list#list',
    )
  })

  it('쿼리가 미리보기뿐이면 물음표도 남기지 않는다', () => {
    expect(fallbackListHref('/emergency?place=3')).toBe('/emergency')
  })
})
