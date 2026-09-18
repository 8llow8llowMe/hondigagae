/**
 * `Set-Cookie` 헤더 읽기 / `Cookie` 헤더 쓰기.
 *
 * **왜 별도 모듈인가**: BFF 가 게이트웨이와 주고받는 쿠키가 둘이 됐다 —
 * `refreshToken`(`@/lib/auth/refresh-cookie`)과 `oauthState`(`@/lib/auth/oauth-state-cookie`).
 * 이름만 다르고 파싱·조립 규칙은 같아서, 두 모듈이 각자 복제하면 한쪽만 고쳐지는 순간
 * 두 쿠키가 다르게 동작한다. 규칙은 여기 하나로 둔다.
 *
 * 순수 함수만 둔다 — Next 런타임에 의존하지 않아 node 환경에서 그대로 테스트된다.
 */

/**
 * `Set-Cookie` 헤더 목록에서 주어진 이름의 값을 뽑는다.
 *
 * - 해당 쿠키가 없으면 `null` (호출부가 "건드리지 않는다" 로 해석한다)
 * - 값이 빈 문자열이면 서버가 쿠키를 지운 것이다 (로그아웃 등) — `null` 과 구분해야 하므로
 *   `''` 를 그대로 돌려준다
 *
 * 속성(`Path`·`Max-Age`·`HttpOnly` …)은 읽지 않는다. BFF 는 값만 중계하고 만료·범위는
 * 자기 쿠키 옵션으로 새로 정한다.
 */
export function readSetCookieValue(
  setCookieHeaders: readonly string[],
  name: string,
): string | null {
  for (const header of setCookieHeaders) {
    const firstPair = header.split(';')[0]
    if (!firstPair) continue

    const separator = firstPair.indexOf('=')
    if (separator < 0) continue

    if (firstPair.slice(0, separator).trim() !== name) continue

    return firstPair.slice(separator + 1).trim()
  }

  return null
}

/** `Cookie` 헤더에 실을 `name=value` 한 쌍 */
export function toCookiePair(name: string, value: string): string {
  return `${name}=${value}`
}

/**
 * 여러 쌍을 `Cookie` 헤더 하나로 잇는다.
 *
 * **헤더는 하나뿐이다.** `headers.Cookie = ...` 를 두 번 쓰면 뒤가 앞을 덮어써서
 * 한쪽 쿠키가 조용히 사라진다 (#689 — refresh 와 oauthState 를 함께 보내야 하는
 * 경우가 실제로 있다). 빈 값은 걸러내고, 남는 것이 없으면 `null` 이라 호출부가
 * 헤더 자체를 붙이지 않는다.
 */
export function joinCookiePairs(pairs: readonly (string | null)[]): string | null {
  const present = pairs.filter((pair): pair is string => pair !== null && pair.length > 0)
  return present.length === 0 ? null : present.join('; ')
}
