import { cookies } from 'next/headers'

import { OAUTH_STATE_COOKIE_NAME } from '@/lib/auth/cookie-names'
import { COOKIE_OPTIONS } from '@/lib/auth/cookie-options'
import { OAUTH_STATE_MAX_AGE_SECONDS } from '@/lib/auth/oauth-state-cookie'
import { seal, unseal } from '@/lib/auth/session-crypto'
import { serverEnv } from '@/lib/env.server'

import 'server-only'

/**
 * 소셜 로그인 CSRF state 를 담는 BFF 자체 쿠키 (#689 / BE #681).
 *
 * 게이트웨이가 `/authorize` 응답에 내려준 state 를 여기서 봉인해 **브라우저에** 심고,
 * 콜백 때 풀어 게이트웨이로 되돌려 보낸다. 서버 메모리에 들고 있으면 안 된다 —
 * "같은 브라우저인가" 를 증명하는 것이 이 값의 존재 이유라, 브라우저에 있어야 한다.
 *
 * 봉인은 세션과 같은 `seal`/`unseal` 을 쓴다. 평문으로 두면 사용자가 콘솔 없이도 값을
 * 바꿔 넣을 수 있고, 그 순간 "게이트웨이가 준 state" 라는 보증이 사라진다.
 *
 * **쿠키는 하나다.** 두 탭에서 동시에 소셜 로그인을 시작하면 나중 것이 앞선 것을 덮어써
 * 먼저 시작한 탭은 `AUTH_010` 을 받는다. 게이트웨이도 쿠키 하나로 같은 동작이라
 * 여기서 탭별로 쪼개면 오히려 백엔드보다 관대해진다.
 *
 * `httpOnly` 라 브라우저 JS 는 읽지 못한다. **값을 로그에 찍지 않는다.**
 */
type SealedOAuthState = { state: string }

/** `/authorize` 응답의 state 를 봉인해 심는다. 수명은 게이트웨이 `Max-Age` 와 같다 */
export async function writeOAuthState(state: string): Promise<void> {
  const store = await cookies()
  store.set(OAUTH_STATE_COOKIE_NAME, seal({ state }, serverEnv.AUTH_SESSION_SECRET), {
    ...COOKIE_OPTIONS,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  })
}

/**
 * 봉인된 state 를 꺼낸다. 없거나 위조됐으면 `null` 이다.
 *
 * `null` 이면 게이트웨이에 쿠키를 싣지 않고 그대로 보낸다 — 백엔드가 `AUTH_010` 으로
 * 거부하는 것이 맞는 동작이고, 화면은 이미 그 코드를 "처음부터 다시" 로 안내한다
 * (`src/features/auth/oauth-error.ts`).
 */
export async function readOAuthState(): Promise<string | null> {
  const store = await cookies()
  const raw = store.get(OAUTH_STATE_COOKIE_NAME)?.value
  if (!raw) return null

  const sealed = unseal<SealedOAuthState>(raw, serverEnv.AUTH_SESSION_SECRET)
  return typeof sealed?.state === 'string' && sealed.state.length > 0 ? sealed.state : null
}

/**
 * 쿠키를 만료시킨다.
 *
 * **콜백이 끝나면 성공·실패와 무관하게 부른다.** state 는 1회용이고 게이트웨이도
 * 조회와 동시에 지운다(Redis `GETDEL`). 실패했을 때만 남겨 두면 다음 시도가 죽은 값을
 * 들고 가서 원인이 엉뚱한 곳처럼 보인다.
 */
export async function clearOAuthState(): Promise<void> {
  const store = await cookies()
  store.set(OAUTH_STATE_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}
