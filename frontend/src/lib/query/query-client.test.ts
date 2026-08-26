import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { createBrowserQueryClient } from '@/lib/query/query-client'

/**
 * 전역 QueryClient 기본값이 실제로 의도대로 동작하는지 확인한다.
 * "설정을 써놓고 안 걸리는" 경우를 막는다 (tooling-guide.md §13 과 같은 취지).
 */
async function runQuery(error: Error) {
  const client = createBrowserQueryClient()
  let attempts = 0

  await client
    .fetchQuery({
      queryKey: ['probe', String(attempts)],
      queryFn: () => {
        attempts += 1
        return Promise.reject(error)
      },
      retryDelay: 0,
    })
    .catch(() => undefined)

  return attempts
}

describe('QueryClient 기본값 — retry 정책', () => {
  it('일시 장애(5xx)는 최대 3회 시도한다 (최초 1 + 재시도 2)', async () => {
    expect(await runQuery(new ApiError(503, 'BFF_GATEWAY_UNREACHABLE', 'fetch failed'))).toBe(3)
  })

  it('데이터 부재(404)는 재시도하지 않는다', async () => {
    expect(await runQuery(new ApiError(404, 'PLACE_001', '없음'))).toBe(1)
  })

  it('미인증(401)은 재시도하지 않는다 (재발급 흐름이 담당한다)', async () => {
    expect(await runQuery(new ApiError(401, null, null))).toBe(1)
  })

  it('입력 오류(400)는 재시도하지 않는다', async () => {
    expect(await runQuery(new ApiError(400, 'PLACE_100', '올바르지 않음'))).toBe(1)
  })
})

describe('QueryClient 기본값 — 실패 후 상태', () => {
  it('재시도를 모두 소진하면 status 가 error 가 되고 isPending 이 풀린다', async () => {
    const client = createBrowserQueryClient()
    const key = ['probe', 'final'] as const

    await client
      .fetchQuery({
        queryKey: key,
        queryFn: () => Promise.reject(new ApiError(503, null, null)),
        retryDelay: 0,
      })
      .catch(() => undefined)

    const state = client.getQueryState(key)

    expect(state?.status).toBe('error')
    expect(state?.fetchStatus).toBe('idle')
    expect(state?.error).toBeInstanceOf(ApiError)
  })
})

describe('QueryClient — 서버 인스턴스 격리', () => {
  it('브라우저 클라이언트를 만들 때마다 새 캐시를 쓴다', () => {
    const a = createBrowserQueryClient()
    const b = createBrowserQueryClient()

    a.setQueryData(['isolation'], 'A')

    expect(b.getQueryData(['isolation'])).toBeUndefined()
  })
})
