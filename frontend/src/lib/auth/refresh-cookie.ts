import { readSetCookieValue, toCookiePair } from '@/lib/http/set-cookie'

/**
 * 게이트웨이가 내려주는 refresh 쿠키를 다룬다.
 *
 * 백엔드 실측 (RefreshCookieProvider):
 *   name     = refreshToken
 *   HttpOnly, SameSite=Strict
 *   Path     = /api/v1/auth/token/reissue
 *
 * Path 가 reissue 로 제한되고 SameSite=Strict 이므로 브라우저가 이 쿠키를 직접
 * 들고 있으면 소셜 로그인 리다이렉트 복귀 시 전송되지 않는다.
 * 그래서 BFF가 값을 꺼내 자체 세션에 봉인하고, reissue 호출 때 Cookie 헤더로 되돌려준다.
 *
 * **oauthState 쿠키와 성격이 다르다** (`@/lib/auth/oauth-state-cookie`). refresh 는
 * 로그인이 끝난 뒤의 장기 자격증명이라 세션에 섞어 보관하지만, state 는 로그인 전에
 * 발급되는 1회용 값이라 세션이 아직 없다. 파싱 규칙만 `@/lib/http/set-cookie` 로 공유한다.
 */
export const REFRESH_COOKIE_NAME = 'refreshToken'

/**
 * Set-Cookie 헤더 목록에서 refresh 토큰 값을 뽑는다.
 *
 * - 헤더에 refreshToken 이 없으면 `null` (세션을 건드리지 않는다)
 * - 값이 빈 문자열이면 백엔드가 쿠키를 지운 것이다 (로그아웃)
 */
export function extractRefreshToken(setCookieHeaders: readonly string[]): string | null {
  return readSetCookieValue(setCookieHeaders, REFRESH_COOKIE_NAME)
}

/** reissue 호출 시 게이트웨이로 보낼 Cookie 헤더 값 */
export function toCookieHeader(refreshToken: string): string {
  return toCookiePair(REFRESH_COOKIE_NAME, refreshToken)
}
