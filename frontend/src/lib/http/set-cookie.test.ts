import { describe, expect, it } from 'vitest'

import { joinCookiePairs, readSetCookieValue, toCookiePair } from '@/lib/http/set-cookie'

describe('readSetCookieValue', () => {
  it('이름이 같은 쿠키의 값을 뽑는다', () => {
    const headers = ['oauthState=abc123; Path=/api/v1/auth; Max-Age=600; HttpOnly; SameSite=Strict']

    expect(readSetCookieValue(headers, 'oauthState')).toBe('abc123')
  })

  it('여러 쿠키 중 이름이 맞는 것만 고른다', () => {
    const headers = [
      'JSESSIONID=xyz; Path=/',
      'refreshToken=r1; Path=/api/v1/auth/token/reissue',
      'oauthState=s1; Path=/api/v1/auth',
    ]

    expect(readSetCookieValue(headers, 'refreshToken')).toBe('r1')
    expect(readSetCookieValue(headers, 'oauthState')).toBe('s1')
  })

  it('접두사가 겹치는 이름을 잘못 집지 않는다', () => {
    expect(readSetCookieValue(['oauthStateExtra=nope; Path=/'], 'oauthState')).toBeNull()
  })

  it('없으면 null 이다', () => {
    expect(readSetCookieValue(['JSESSIONID=xyz; Path=/'], 'oauthState')).toBeNull()
    expect(readSetCookieValue([], 'oauthState')).toBeNull()
  })

  it('서버가 쿠키를 지운 경우 빈 문자열이다 — null 과 구분된다', () => {
    expect(readSetCookieValue(['oauthState=; Path=/api/v1/auth; Max-Age=0'], 'oauthState')).toBe('')
  })

  it('`=` 가 없는 헤더는 건너뛴다', () => {
    expect(readSetCookieValue(['broken', 'oauthState=ok'], 'oauthState')).toBe('ok')
  })
})

describe('toCookiePair', () => {
  it('name=value 한 쌍을 만든다', () => {
    expect(toCookiePair('oauthState', 'abc')).toBe('oauthState=abc')
  })
})

describe('joinCookiePairs', () => {
  it('여러 쌍을 `; ` 로 잇는다 — 헤더가 하나뿐이라 덮어쓰면 안 된다', () => {
    expect(joinCookiePairs(['refreshToken=r1', 'oauthState=s1'])).toBe(
      'refreshToken=r1; oauthState=s1',
    )
  })

  it('없는 쌍은 걸러낸다', () => {
    expect(joinCookiePairs([null, 'oauthState=s1'])).toBe('oauthState=s1')
    expect(joinCookiePairs(['refreshToken=r1', ''])).toBe('refreshToken=r1')
  })

  it('남는 것이 없으면 null 이다 — 호출부가 헤더를 붙이지 않는다', () => {
    expect(joinCookiePairs([null, null])).toBeNull()
    expect(joinCookiePairs([])).toBeNull()
  })
})
