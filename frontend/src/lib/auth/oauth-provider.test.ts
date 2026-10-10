import { describe, expect, it } from 'vitest'

import { isOAuthProvider, OAUTH_PROVIDERS, oauthProviderName } from '@/lib/auth/oauth-provider'

describe('oauth provider', () => {
  it('백엔드 OAuthProvider enum 과 같은 둘만 있다', () => {
    expect([...OAUTH_PROVIDERS]).toEqual(['kakao', 'naver'])
  })

  it('표시 이름은 백엔드 description 과 같다 — AUTH_008 문구와 같은 말을 쓴다', () => {
    expect(oauthProviderName('kakao')).toBe('카카오')
    expect(oauthProviderName('naver')).toBe('네이버')
  })

  it('모르는 값은 null 이다', () => {
    expect(oauthProviderName('google')).toBeNull()
    expect(isOAuthProvider('google')).toBe(false)
  })

  it('경로 세그먼트가 상속 키여도 값이 새지 않는다 — 표가 Map 인 이유', () => {
    // 객체 리터럴이면 'toString' 이 함수를 돌려줘 React 가 렌더 중에 터진다
    expect(oauthProviderName('toString')).toBeNull()
    expect(isOAuthProvider('toString')).toBe(false)
    expect(oauthProviderName('__proto__')).toBeNull()
  })
})
