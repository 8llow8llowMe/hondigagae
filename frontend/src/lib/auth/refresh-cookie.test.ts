import { describe, expect, it } from 'vitest'

import { extractRefreshToken, toCookieHeader } from '@/lib/auth/refresh-cookie'

describe('extractRefreshToken', () => {
  it('백엔드 형식의 Set-Cookie 에서 refresh 토큰을 뽑는다', () => {
    const headers = [
      'refreshToken=abc.def.ghi; Path=/api/v1/auth/token/reissue; Max-Age=1209600; HttpOnly; SameSite=Strict',
    ]

    expect(extractRefreshToken(headers)).toBe('abc.def.ghi')
  })

  it('여러 쿠키 중에서 refreshToken 만 고른다', () => {
    const headers = [
      'JSESSIONID=xyz; Path=/',
      'refreshToken=target; Path=/api/v1/auth/token/reissue',
    ]

    expect(extractRefreshToken(headers)).toBe('target')
  })

  it('refreshToken 이 없으면 null 을 반환한다 (세션을 건드리지 않는다)', () => {
    expect(extractRefreshToken(['JSESSIONID=xyz; Path=/'])).toBeNull()
    expect(extractRefreshToken([])).toBeNull()
  })

  it('로그아웃으로 쿠키를 비운 경우 빈 문자열을 반환한다', () => {
    const headers = ['refreshToken=; Path=/api/v1/auth/token/reissue; Max-Age=0; HttpOnly']

    expect(extractRefreshToken(headers)).toBe('')
  })
})

describe('toCookieHeader', () => {
  it('게이트웨이로 되돌려보낼 Cookie 헤더를 만든다', () => {
    expect(toCookieHeader('abc.def')).toBe('refreshToken=abc.def')
  })
})
