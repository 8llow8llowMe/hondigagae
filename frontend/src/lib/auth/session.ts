import { cookies } from 'next/headers'

import { SESSION_COOKIE_NAME } from '@/lib/auth/cookie-names'
import { COOKIE_OPTIONS } from '@/lib/auth/cookie-options'
import { seal, unseal } from '@/lib/auth/session-crypto'
import { serverEnv } from '@/lib/env.server'

import 'server-only'

/**
 * 서버 세션. 토큰은 여기에만 존재한다.
 * 클라이언트 상태에는 세션에서 파생된 얕은 값(memberId, isAuthenticated)만 둔다
 * — docs/auth-guide.md §2.
 */
export { SESSION_COOKIE_NAME }

export type Session = {
  accessToken: string
  refreshToken: string
  memberId: string
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE_NAME)?.value
  if (!raw) return null

  return unseal<Session>(raw, serverEnv.AUTH_SESSION_SECRET)
}

export async function writeSession(session: Session): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, seal(session, serverEnv.AUTH_SESSION_SECRET), COOKIE_OPTIONS)
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}

/** 클라이언트로 내려보낼 수 있는 얕은 값만 추린다. 토큰은 절대 포함하지 않는다 */
export function toPublicSession(session: Session | null): {
  isAuthenticated: boolean
  memberId: string | null
} {
  return {
    isAuthenticated: session !== null,
    memberId: session?.memberId ?? null,
  }
}
