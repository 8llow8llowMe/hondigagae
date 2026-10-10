import { describe, expect, it } from 'vitest'

import { canRetryReissue, isAuthEntryPath, isReissuePath } from '@/lib/auth/reissue'

describe('canRetryReissue', () => {
  it('첫 시도는 허용한다', () => {
    expect(canRetryReissue(0)).toBe(true)
  })

  it('2회차 시도는 막는다 (무한 루프 방지)', () => {
    expect(canRetryReissue(1)).toBe(false)
  })

  it('그 이후도 막는다', () => {
    expect(canRetryReissue(5)).toBe(false)
  })
})

describe('isReissuePath', () => {
  it('재발급 경로를 식별한다', () => {
    expect(isReissuePath('/auth/token/reissue')).toBe(true)
  })

  it('앞 슬래시가 없어도 식별한다', () => {
    expect(isReissuePath('auth/token/reissue')).toBe(true)
  })

  it('다른 경로는 재발급 경로가 아니다', () => {
    expect(isReissuePath('/auth/login')).toBe(false)
    expect(isReissuePath('/places')).toBe(false)
  })
})

describe('isAuthEntryPath', () => {
  it('일반 로그인은 인증 진입 경로다', () => {
    expect(isAuthEntryPath('/auth/login')).toBe(true)
  })

  it('소셜 로그인 콜백도 인증 진입 경로다', () => {
    expect(isAuthEntryPath('/auth/kakao/login')).toBe(true)
    expect(isAuthEntryPath('/auth/naver/login')).toBe(true)
  })

  it('쿼리스트링이 붙어도 판정한다', () => {
    expect(isAuthEntryPath('/auth/kakao/login?code=abc&state=xyz')).toBe(true)
  })

  it('앞의 슬래시가 여러 개여도 판정한다', () => {
    expect(isAuthEntryPath('//auth/login')).toBe(true)
  })

  it('재발급·로그아웃은 인증 진입 경로가 아니다', () => {
    expect(isAuthEntryPath('/auth/token/reissue')).toBe(false)
    expect(isAuthEntryPath('/auth/logout')).toBe(false)
  })

  it('일반 리소스 경로는 아니다', () => {
    expect(isAuthEntryPath('/places')).toBe(false)
    expect(isAuthEntryPath('/members/me/pets')).toBe(false)
  })
})
