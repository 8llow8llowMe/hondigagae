import { describe, expect, it } from 'vitest'

import { canRetryReissue, isReissuePath } from '@/lib/auth/reissue'

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
