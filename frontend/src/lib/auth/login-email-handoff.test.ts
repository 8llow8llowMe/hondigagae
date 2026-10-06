import { afterEach, describe, expect, it } from 'vitest'

import {
  handOffLoginEmail,
  LOGIN_EMAIL_HANDOFF_STORAGE_KEY,
  takeHandedOffLoginEmail,
} from '@/lib/auth/login-email-handoff'

/** `environment: 'node'` 라 `sessionStorage` 가 없다 — `saved-login-email.test.ts` 와 같은 최소 구현 */
function useStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial))
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })
  return store
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'sessionStorage')
})

/*
  **이메일을 URL 에 싣지 않는다** (#1158). `/login?email=…` 은 브라우저 기록 · 서버 접근 로그 ·
  Referer 에 남는다. 탭 범위 저장소에 한 번 넘기고 로그인 화면이 한 번 읽고 지운다.
*/
describe('로그인 화면으로 이메일 넘기기 (#1158)', () => {
  it('넘긴 이메일을 한 번 읽는다', () => {
    useStorage()
    handOffLoginEmail('a@b.c')

    expect(takeHandedOffLoginEmail()).toBe('a@b.c')
  })

  it('읽으면 지운다 — 다음 방문에 지난 값이 채워지지 않게', () => {
    const store = useStorage()
    handOffLoginEmail('a@b.c')
    takeHandedOffLoginEmail()

    expect(store.has(LOGIN_EMAIL_HANDOFF_STORAGE_KEY)).toBe(false)
    expect(takeHandedOffLoginEmail()).toBeNull()
  })

  it('빈 값은 넘기지 않는다', () => {
    const store = useStorage()
    handOffLoginEmail('   ')

    expect(store.size).toBe(0)
  })

  it('저장소가 던져도 화면은 깨지지 않는다 — 사용자가 직접 입력하면 된다', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })

    expect(() => handOffLoginEmail('a@b.c')).not.toThrow()
    expect(takeHandedOffLoginEmail()).toBeNull()
  })
})
