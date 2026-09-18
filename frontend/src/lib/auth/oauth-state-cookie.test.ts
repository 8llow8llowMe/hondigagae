import { describe, expect, it } from 'vitest'

import {
  extractOAuthState,
  isOAuthAuthorizePath,
  isOAuthCallbackPath,
  OAUTH_STATE_MAX_AGE_SECONDS,
  toOAuthStateCookiePair,
} from '@/lib/auth/oauth-state-cookie'

describe('extractOAuthState', () => {
  it('백엔드 형식의 Set-Cookie 에서 state 를 뽑는다', () => {
    const headers = [
      'oauthState=8f2b1c; Path=/api/v1/auth; Max-Age=600; HttpOnly; Secure; SameSite=Strict',
    ]

    expect(extractOAuthState(headers)).toBe('8f2b1c')
  })

  it('refresh 쿠키와 함께 와도 state 만 고른다', () => {
    const headers = [
      'refreshToken=r.t.k; Path=/api/v1/auth/token/reissue; HttpOnly',
      'oauthState=8f2b1c; Path=/api/v1/auth; HttpOnly',
    ]

    expect(extractOAuthState(headers)).toBe('8f2b1c')
  })

  it('없으면 null 이다 — 백엔드가 아직 이 쿠키를 내리지 않는 과도기가 여기로 온다', () => {
    expect(extractOAuthState(['refreshToken=r.t.k; Path=/api/v1/auth/token/reissue'])).toBeNull()
    expect(extractOAuthState([])).toBeNull()
  })
})

describe('toOAuthStateCookiePair', () => {
  it('게이트웨이로 되돌려보낼 쌍을 만든다', () => {
    expect(toOAuthStateCookiePair('8f2b1c')).toBe('oauthState=8f2b1c')
  })
})

describe('OAUTH_STATE_MAX_AGE_SECONDS', () => {
  it('백엔드 Max-Age 와 같은 600 초다 — 한쪽만 바꾸면 흐름이 어긋난다', () => {
    expect(OAUTH_STATE_MAX_AGE_SECONDS).toBe(600)
  })
})

describe('isOAuthAuthorizePath', () => {
  it('제공자별 인가 시작 경로를 잡는다', () => {
    expect(isOAuthAuthorizePath('/auth/kakao/authorize')).toBe(true)
    expect(isOAuthAuthorizePath('auth/naver/authorize')).toBe(true)
    expect(isOAuthAuthorizePath('/auth/kakao/authorize?termsAgreed=true')).toBe(true)
  })

  it('콜백·일반 로그인·다른 경로는 잡지 않는다', () => {
    expect(isOAuthAuthorizePath('/auth/kakao/login')).toBe(false)
    expect(isOAuthAuthorizePath('/auth/login')).toBe(false)
    expect(isOAuthAuthorizePath('/auth/kakao/authorize/extra')).toBe(false)
    expect(isOAuthAuthorizePath('/members/me')).toBe(false)
  })
})

describe('isOAuthCallbackPath', () => {
  it('제공자별 콜백 경로만 잡는다', () => {
    expect(isOAuthCallbackPath('/auth/kakao/login')).toBe(true)
    expect(isOAuthCallbackPath('auth/naver/login')).toBe(true)
    expect(isOAuthCallbackPath('/auth/kakao/login?code=c&state=s')).toBe(true)
  })

  it('일반 로그인은 소셜 콜백이 아니다 — state 쿠키를 붙이면 안 된다', () => {
    expect(isOAuthCallbackPath('/auth/login')).toBe(false)
  })

  it('인가 시작·재발급은 잡지 않는다', () => {
    expect(isOAuthCallbackPath('/auth/kakao/authorize')).toBe(false)
    expect(isOAuthCallbackPath('/auth/token/reissue')).toBe(false)
  })
})
