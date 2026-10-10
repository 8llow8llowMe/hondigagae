import { afterEach, describe, expect, it, vi } from 'vitest'

import { rememberReturnTo, takeReturnTo } from '@/lib/auth/oauth-return-to'

/**
 * node 환경에는 sessionStorage 가 없다. 그 자체가 검증 대상이다 —
 * **저장소가 없어도 로그인은 성립해야 한다** (사파리 비공개 모드가 같은 상황이다).
 */
type Scope = typeof globalThis & { sessionStorage?: Storage }

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size
    },
  }
}

afterEach(() => {
  delete (globalThis as Scope).sessionStorage
  vi.restoreAllMocks()
})

describe('takeReturnTo', () => {
  it('저장한 경로를 돌려주고 지운다 — 왕복 1회용이다', () => {
    ;(globalThis as Scope).sessionStorage = fakeStorage()

    rememberReturnTo('/plans')
    expect(takeReturnTo()).toBe('/plans')
    // 남겨 두면 다음 로그인이 엉뚱한 곳으로 간다
    expect(takeReturnTo()).toBe('/')
  })

  it('외부 오리진은 통과하지 못한다 — 오픈 리다이렉트 방어', () => {
    const storage = fakeStorage()
    ;(globalThis as Scope).sessionStorage = storage

    // 저장소는 브라우저에 있어 사용자가 콘솔로 바꿀 수 있다 — 우리가 넣은 값이라도 신뢰 경계 밖이다
    for (const forged of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)']) {
      storage.setItem('hondigagae.oauth.returnTo', forged)
      expect(takeReturnTo()).toBe('/')
    }
  })

  it('저장소가 없으면 조용히 / 로 떨어진다 — 던지지 않는다', () => {
    expect(takeReturnTo()).toBe('/')
    expect(() => rememberReturnTo('/plans')).not.toThrow()
  })

  it('저장소가 던져도 로그인을 막지 않는다', () => {
    ;(globalThis as Scope).sessionStorage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('사이트 데이터 차단')
      },
      setItem: () => {
        throw new Error('사이트 데이터 차단')
      },
    }

    expect(() => rememberReturnTo('/plans')).not.toThrow()
    expect(takeReturnTo()).toBe('/')
  })
})
