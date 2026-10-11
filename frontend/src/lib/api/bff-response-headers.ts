/**
 * BFF 가 게이트웨이 응답에서 브라우저로 **넘기는 헤더** (#1309). 지금은 `Retry-After` 하나다.
 *
 * **헤더를 통째로 넘기지 않는다.** 게이트웨이 응답에는 refresh · 소셜 state 의 `Set-Cookie` 가
 * 있고, 그 값은 BFF 가 세션에 봉인하는 것이지 브라우저에 줄 것이 아니다 (`route.ts` 책임 3).
 * `Content-Length` · `Content-Encoding` 처럼 BFF 가 본문을 다시 만들며 틀려지는 헤더도 있다.
 * 필요한 헤더를 이름으로 골라 새로 단다 — 요청 쪽 규칙(필요한 헤더만 새로 구성)과 같다.
 *
 * env · transport 의존이 없는 순수 함수라 테스트할 수 있다.
 */

/**
 * 게이트웨이 응답의 `Retry-After` 원문. 없거나 비었으면 `null`.
 *
 * **해석하지 않고 원문을 넘긴다.** 초로 읽는 것은 받는 쪽 한 곳(`parseRetryAfterSeconds`)이다 —
 * 여기서도 읽으면 두 곳의 규칙이 갈릴 수 있다.
 */
export function readRetryAfter(gatewayHeaders: Headers): string | null {
  const value = gatewayHeaders.get('retry-after')?.trim() ?? ''
  return value.length > 0 ? value : null
}

/** 브라우저 응답에 달 헤더. 넘길 값이 없으면 `undefined` — `NextResponse.json` 의 `headers` 자리 */
export function bffResponseHeaders(retryAfter: string | null): Record<string, string> | undefined {
  return retryAfter === null ? undefined : { 'Retry-After': retryAfter }
}
