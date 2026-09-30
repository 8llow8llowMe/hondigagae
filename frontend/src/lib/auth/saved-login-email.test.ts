import { afterEach, describe, expect, it } from 'vitest'

import {
  clearSavedLoginEmail,
  forgetsSavedLoginEmail,
  readSavedLoginEmail,
  resolveInitialLoginEmail,
  SAVED_LOGIN_EMAIL_STORAGE_KEY,
  saveLoginEmail,
} from '@/lib/auth/saved-login-email'

/**
 * **`environment: 'node'` 라 `localStorage` 가 없다** — `recent-place.test.ts` 와 같은
 * 최소 구현을 꽂는다 (`docs/testing-guide.md` §1).
 */
function useStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial))

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })

  return store
}

/** 저장소 접근 자체가 던지는 환경 — 사파리 프라이빗 모드 */
function useThrowingStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError')
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('SAVED_LOGIN_EMAIL_STORAGE_KEY', () => {
  it('hdg_ 접두 규약을 따른다', () => {
    expect(SAVED_LOGIN_EMAIL_STORAGE_KEY).toBe('hdg_saved_login_email')
  })
})

describe('readSavedLoginEmail', () => {
  it('저장된 이메일을 돌려준다', () => {
    useStorage({ [SAVED_LOGIN_EMAIL_STORAGE_KEY]: 'demo@hondigagae.dev' })

    expect(readSavedLoginEmail()).toBe('demo@hondigagae.dev')
  })

  it('저장된 것이 없으면 null 이다', () => {
    useStorage()

    expect(readSavedLoginEmail()).toBeNull()
  })

  it('공백뿐인 값은 없는 것으로 본다', () => {
    useStorage({ [SAVED_LOGIN_EMAIL_STORAGE_KEY]: '   ' })

    expect(readSavedLoginEmail()).toBeNull()
  })

  it('저장소가 던지면 null 이다', () => {
    useThrowingStorage()

    expect(readSavedLoginEmail()).toBeNull()
  })

  it('저장소가 없는 환경(SSR)이면 null 이다', () => {
    expect(readSavedLoginEmail()).toBeNull()
  })
})

describe('saveLoginEmail', () => {
  it('앞뒤 공백을 걷고 저장한다', () => {
    const store = useStorage()

    saveLoginEmail('  demo@hondigagae.dev ')

    expect(store.get(SAVED_LOGIN_EMAIL_STORAGE_KEY)).toBe('demo@hondigagae.dev')
  })

  it('이전 값을 덮어쓴다', () => {
    const store = useStorage({ [SAVED_LOGIN_EMAIL_STORAGE_KEY]: 'old@example.com' })

    saveLoginEmail('new@example.com')

    expect(store.get(SAVED_LOGIN_EMAIL_STORAGE_KEY)).toBe('new@example.com')
  })

  it('빈 값은 저장하지 않고 기존 값을 지운다', () => {
    const store = useStorage({ [SAVED_LOGIN_EMAIL_STORAGE_KEY]: 'old@example.com' })

    saveLoginEmail('  ')

    expect(store.has(SAVED_LOGIN_EMAIL_STORAGE_KEY)).toBe(false)
  })

  it('저장소가 던져도 던지지 않는다', () => {
    useThrowingStorage()

    expect(() => saveLoginEmail('demo@hondigagae.dev')).not.toThrow()
  })
})

describe('clearSavedLoginEmail', () => {
  it('저장된 이메일을 지운다', () => {
    const store = useStorage({ [SAVED_LOGIN_EMAIL_STORAGE_KEY]: 'demo@hondigagae.dev' })

    clearSavedLoginEmail()

    expect(store.has(SAVED_LOGIN_EMAIL_STORAGE_KEY)).toBe(false)
  })

  it('저장소가 던져도 던지지 않는다', () => {
    useThrowingStorage()

    expect(() => clearSavedLoginEmail()).not.toThrow()
  })
})

describe('resolveInitialLoginEmail', () => {
  it('쿼리 이메일이 저장값보다 우선한다', () => {
    expect(resolveInitialLoginEmail('query@example.com', 'saved@example.com')).toEqual({
      email: 'query@example.com',
      remember: true,
    })
  })

  it('쿼리가 비었으면 저장값을 쓴다', () => {
    expect(resolveInitialLoginEmail('', 'saved@example.com')).toEqual({
      email: 'saved@example.com',
      remember: true,
    })
  })

  it('공백뿐인 쿼리는 없는 것으로 본다', () => {
    expect(resolveInitialLoginEmail('  ', 'saved@example.com')).toEqual({
      email: 'saved@example.com',
      remember: true,
    })
  })

  it('저장값이 없으면 체크는 꺼진 채다 — 기본 꺼짐', () => {
    expect(resolveInitialLoginEmail('query@example.com', null)).toEqual({
      email: 'query@example.com',
      remember: false,
    })
    expect(resolveInitialLoginEmail('', null)).toEqual({ email: '', remember: false })
  })
})

describe('forgetsSavedLoginEmail', () => {
  it('탈퇴와 소셜 전용 전환이면 지운다', () => {
    expect(forgetsSavedLoginEmail('withdrawn')).toBe(true)
    expect(forgetsSavedLoginEmail('password-removed')).toBe(true)
  })

  it('로그아웃과 비밀번호 변경이면 남긴다', () => {
    expect(forgetsSavedLoginEmail(undefined)).toBe(false)
    expect(forgetsSavedLoginEmail('password-changed')).toBe(false)
  })
})
