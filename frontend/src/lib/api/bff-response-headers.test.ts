import { describe, expect, it } from 'vitest'

import { bffResponseHeaders, readRetryAfter } from '@/lib/api/bff-response-headers'

/**
 * BFF 가 넘기는 응답 헤더 (#1309). **`Retry-After` 하나뿐이다** — 게이트웨이 응답의 refresh ·
 * 소셜 state `Set-Cookie` 가 브라우저로 새면 BFF 의 토큰 봉인(책임 2 · 3)이 무너진다.
 */
function gatewayHeaders(extra: Record<string, string> = {}): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Content-Length': '123',
    'X-Request-Id': 'abc',
    ...extra,
  })
  headers.append('Set-Cookie', 'refresh_token=secret; HttpOnly; Path=/api/v1/auth')
  return headers
}

describe('readRetryAfter', () => {
  it('게이트웨이의 Retry-After 원문을 읽는다', () => {
    expect(readRetryAfter(gatewayHeaders({ 'Retry-After': '60' }))).toBe('60')
  })

  it('해석하지 않는다 — 초로 읽는 것은 받는 쪽(parseRetryAfterSeconds) 한 곳이다', () => {
    const date = 'Wed, 21 Oct 2026 07:28:00 GMT'

    expect(readRetryAfter(gatewayHeaders({ 'Retry-After': date }))).toBe(date)
  })

  it('없거나 비었으면 null 이다', () => {
    expect(readRetryAfter(gatewayHeaders())).toBeNull()
    expect(readRetryAfter(gatewayHeaders({ 'Retry-After': '  ' }))).toBeNull()
  })
})

describe('bffResponseHeaders', () => {
  it('값이 있으면 Retry-After 하나만 단다', () => {
    expect(bffResponseHeaders('60')).toEqual({ 'Retry-After': '60' })
  })

  it('값이 없으면 헤더를 달지 않는다', () => {
    expect(bffResponseHeaders(null)).toBeUndefined()
  })

  it('다른 헤더는 넘기지 않는다 — Set-Cookie · Content-Length 가 따라오지 않는다', () => {
    const forwarded = bffResponseHeaders(readRetryAfter(gatewayHeaders({ 'Retry-After': '600' })))

    expect(Object.keys(forwarded ?? {})).toEqual(['Retry-After'])
    expect(JSON.stringify(forwarded)).not.toContain('refresh_token')
  })
})
