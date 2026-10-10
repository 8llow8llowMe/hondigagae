import { afterEach, describe, expect, it, vi } from 'vitest'

import { clientFetchNullable } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { fail, ok } from '@/test/api'

/**
 * 선택적 하위 리소스 조회 전송 (#979).
 *
 * 공유 링크 · 후기 GET 은 "아직 없음" 을 **200 + `dataBody: null`** 로 답한다. 이 경로가
 * 지키는 것은 둘이다 — null 은 값으로 돌려주고, 실패(일정 없음 `PLAN_001` 404 등)는
 * `clientFetch` 와 똑같이 `ApiError` 로 던진다.
 */
function stubFetch(status: number, payload: unknown): string[] {
  const urls: string[] = []

  vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
    urls.push(url)
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }) as unknown as typeof globalThis.fetch)

  return urls
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('clientFetchNullable', () => {
  it('BFF 경로로 부른다', async () => {
    const urls = stubFetch(200, ok(null))

    await clientFetchNullable('/plans/1/share-link')

    expect(urls).toEqual(['/api/bff/plans/1/share-link'])
  })

  it('200 + dataBody null 이면 null 을 돌려준다 — 오류가 아니다', async () => {
    stubFetch(200, ok(null))

    await expect(clientFetchNullable('/plans/1/share-link')).resolves.toBeNull()
  })

  it('값이 있으면 dataBody 를 돌려준다', async () => {
    stubFetch(200, ok({ token: 'abc', expiresAt: '2026-10-29T10:00:00' }))

    await expect(clientFetchNullable('/plans/1/share-link')).resolves.toEqual({
      token: 'abc',
      expiresAt: '2026-10-29T10:00:00',
    })
  })

  it('일정이 없는 404 PLAN_001 은 null 로 접지 않고 ApiError 로 던진다', async () => {
    stubFetch(404, fail('PLAN_001', '존재하지 않는 여행 일정입니다.'))

    const error = await clientFetchNullable('/plans/1/reviews').catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
    expect((error as ApiError).resultCode).toBe('PLAN_001')
  })

  it('네트워크 무응답은 일시 장애 ApiError 다', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await clientFetchNullable('/plans/1/reviews').catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).kind).toBe('temporary')
  })
})
