import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clientFetch,
  clientFetchForm,
  clientFetchNullable,
  clientFetchVoid,
} from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { fail, ok } from '@/test/api'

/**
 * 429 의 `Retry-After` 를 `ApiError.retryAfterSeconds` 에 싣는다 (#1309).
 *
 * 래퍼 판별(`unwrap*`)은 본문만 보는 순수 함수라 헤더를 모른다 — 전송 계층이 붙여야 한다. 네 전송
 * 함수 중 하나라도 빠지면 그 호출의 화면만 남은 시간을 못 보인다.
 */
const TOO_FREQUENT = '인증코드 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.'

function stubFetch(status: number, payload: unknown, headers: Record<string, string> = {}): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      }),
    ),
  )
}

async function thrown(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Retry-After → ApiError.retryAfterSeconds', () => {
  const calls = {
    clientFetch: () => clientFetch('/auth/email/send-code', { method: 'POST', body: {} }),
    clientFetchNullable: () => clientFetchNullable('/plans/1/share-link'),
    clientFetchVoid: () => clientFetchVoid('/auth/logout', { method: 'POST' }),
    clientFetchForm: () => clientFetchForm('/pets/1/image', { body: new FormData() }),
  }

  for (const [name, call] of Object.entries(calls)) {
    it(`${name}: 429 의 헤더 초를 싣고, 판별 결과(코드 · 문구)는 그대로다`, async () => {
      stubFetch(429, fail('AUTH_003', TOO_FREQUENT), { 'Retry-After': '60' })

      const error = await thrown(call())

      expect(error.retryAfterSeconds).toBe(60)
      expect(error.status).toBe(429)
      expect(error.resultCode).toBe('AUTH_003')
      expect(error.message).toBe(TOO_FREQUENT)
    })
  }

  it('헤더가 없으면 null 이다', async () => {
    stubFetch(429, fail('AUTH_003', TOO_FREQUENT))

    expect((await thrown(calls.clientFetch())).retryAfterSeconds).toBeNull()
  })

  it('정수 초가 아니면 null 이다 — 화면이 대체값을 쓴다', async () => {
    stubFetch(429, fail('AUTH_003', TOO_FREQUENT), {
      'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT',
    })

    expect((await thrown(calls.clientFetch())).retryAfterSeconds).toBeNull()
  })

  it('성공 응답은 헤더와 무관하게 dataBody 를 돌려준다', async () => {
    stubFetch(200, ok({ codeExpiresInSeconds: 300, resendAvailableInSeconds: 60 }), {
      'Retry-After': '60',
    })

    await expect(calls.clientFetch()).resolves.toEqual({
      codeExpiresInSeconds: 300,
      resendAvailableInSeconds: 60,
    })
  })
})
