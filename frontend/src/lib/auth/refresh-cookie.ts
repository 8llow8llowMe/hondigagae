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
 */
export const REFRESH_COOKIE_NAME = 'refreshToken'

/**
 * Set-Cookie 헤더 목록에서 refresh 토큰 값을 뽑는다.
 *
 * - 헤더에 refreshToken 이 없으면 `null` (세션을 건드리지 않는다)
 * - 값이 빈 문자열이면 백엔드가 쿠키를 지운 것이다 (로그아웃)
 */
export function extractRefreshToken(setCookieHeaders: readonly string[]): string | null {
  for (const header of setCookieHeaders) {
    const firstPair = header.split(';')[0]
    if (!firstPair) continue

    const separator = firstPair.indexOf('=')
    if (separator < 0) continue

    const name = firstPair.slice(0, separator).trim()
    if (name !== REFRESH_COOKIE_NAME) continue

    return firstPair.slice(separator + 1).trim()
  }

  return null
}

/** reissue 호출 시 게이트웨이로 보낼 Cookie 헤더 값 */
export function toCookieHeader(refreshToken: string): string {
  return `${REFRESH_COOKIE_NAME}=${refreshToken}`
}
