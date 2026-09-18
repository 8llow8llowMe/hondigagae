import { readSetCookieValue, toCookiePair } from '@/lib/http/set-cookie'

/**
 * 게이트웨이가 소셜 로그인 CSRF state 를 담아 내려주는 쿠키를 다룬다 (#689 / BE #681).
 *
 * 백엔드 계약 (#681 확정):
 *   GET /api/v1/auth/{provider}/authorize
 *     → Set-Cookie: oauthState=<state>; HttpOnly; Secure; SameSite=Strict;
 *                   Path=/api/v1/auth; Max-Age=600
 *   GET /api/v1/auth/{provider}/login?code=&state=
 *     → Cookie: oauthState=<state> 가 있어야 하고 쿼리 state 와 같아야 한다
 *     → 없거나 다르면 AUTH_010 (INVALID_OAUTH_STATE)
 *
 * **이 값이 브라우저에 묶여야 의미가 있다.** 공격자가 자기 단말에서 `/authorize` 를 불러
 * state 를 받아도 그 쿠키는 공격자에게만 남고, 피해자 브라우저에는 없어서 콜백이 거부된다.
 * 그래서 BFF 가 값을 서버 메모리에 들고 있으면 안 되고, 자체 쿠키로 **브라우저에 심어야**
 * 한다 (`@/lib/auth/oauth-state`).
 *
 * 게이트웨이 쿠키를 브라우저로 그대로 통과시키지 않는 이유는 `Path=/api/v1/auth` 다 —
 * 브라우저가 보는 경로는 `/api/bff/auth/...` 라 그 Path 로는 되돌아오지 않는다.
 * refresh 쿠키가 세션에 봉인되는 것과 같은 사정이다 (`./refresh-cookie.ts`).
 *
 * 순수 함수만 둔다. 쿠키 저장소 접근은 `./oauth-state.ts` 가 맡는다.
 */
export const GATEWAY_OAUTH_STATE_COOKIE_NAME = 'oauthState'

/**
 * 백엔드 `Max-Age=600` 과 같은 값(초).
 *
 * BFF 쿠키가 더 오래 살면 게이트웨이가 이미 버린 state 를 들고 콜백을 태우게 되고,
 * 더 짧으면 아직 유효한 로그인이 우리 쪽 사정으로 끊긴다. 한쪽만 바꾸지 않는다.
 */
export const OAUTH_STATE_MAX_AGE_SECONDS = 600

/** `/authorize` 응답의 Set-Cookie 에서 state 를 뽑는다. 없으면 `null` */
export function extractOAuthState(setCookieHeaders: readonly string[]): string | null {
  return readSetCookieValue(setCookieHeaders, GATEWAY_OAUTH_STATE_COOKIE_NAME)
}

/** 콜백 호출 시 게이트웨이로 되돌려 보낼 `Cookie` 헤더의 한 쌍 */
export function toOAuthStateCookiePair(state: string): string {
  return toCookiePair(GATEWAY_OAUTH_STATE_COOKIE_NAME, state)
}

/*
  경로 판정은 여기 둘로 모은다 (#689).

  BFF 는 catch-all 이라 "이 요청이 소셜 인가 시작인가 / 콜백인가" 를 경로 문자열로만
  알 수 있다. 판정을 호출부마다 정규식으로 박으면 백엔드가 경로를 바꿀 때 한 곳만 고쳐져
  **state 를 심기만 하고 지우지 않는(또는 그 반대의) 절반짜리 상태**가 된다.

  `isAuthEntryPath`(`./reissue.ts`)와 겹치지만 목적이 다르다. 그쪽은 "401 을 재발급으로
  복구하면 안 되는 경로" 이고 일반 로그인(`/auth/login`)까지 포함한다 — state 쿠키와는
  무관하다. 겹친다고 하나로 합치면 일반 로그인에도 state 쿠키를 붙이게 된다.
*/
const OAUTH_AUTHORIZE_PATTERN = /^auth\/[^/]+\/authorize$/
const OAUTH_CALLBACK_PATTERN = /^auth\/[^/]+\/login$/

function normalize(path: string): string {
  return (path.split('?')[0] ?? '').replace(/^\/+/, '')
}

/** 소셜 인가 시작 — 응답의 state 를 봉인해 브라우저에 심어야 하는 경로 */
export function isOAuthAuthorizePath(path: string): boolean {
  return OAUTH_AUTHORIZE_PATTERN.test(normalize(path))
}

/** 소셜 콜백 — 봉인된 state 를 풀어 게이트웨이로 실어 보내고, 끝나면 지워야 하는 경로 */
export function isOAuthCallbackPath(path: string): boolean {
  return OAUTH_CALLBACK_PATTERN.test(normalize(path))
}
